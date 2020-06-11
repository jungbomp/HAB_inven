"use strict";

const fetch = require("node-fetch");
const express = require("express");
const router = express.Router();

const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

const configReader = require('../util/configReader')();
const datetimeUtil = require('../util/datetimeUtil')();

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets", 
  "https://www.googleapis.com/auth/drive"
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";
const CREDENTIAL_FILE_PATH = "credentials.json";

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize() {
  return new Promise((resolve, reject) => {
    fs.readFile(CREDENTIAL_FILE_PATH, (err, content) => {
      if (err) {
        console.log("Error loading client secret file:", err);
        reject();
      }
      // Authorize a client with credentials, then call the Google Sheets API.
      const credentials = JSON.parse(content);
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) getNewToken(oAuth2Client, resolve);
        else {
          oAuth2Client.setCredentials(JSON.parse(token));
          resolve(oAuth2Client);
        }
      });
    });
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question("Enter the code from that page here: ", code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return console.error(
          "Error while trying to retrieve access token",
          err
        );
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
} 
  
function listTemplateFiles(query, pageToken) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const drive = google.drive({ version: "v3", auth: auth });

      // const params = {
      //   q: `mimeType = 'application/vnd.google-apps.folder' and fullText contains '${query}'`,
      //   // fields: 'nextPageToken, items(id, title)',
      //   spaces: 'drive',
      //   pageToken: pageToken
      // };

      const params = {
        q: `mimeType = 'application/vnd.google-apps.spreadsheet' and fullText contains '${query}'`,
        // fields: 'nextPageToken, items(id, title)',
        spaces: 'drive',
        pageToken: pageToken
      };
      drive.files.list(params)
      .then(res => {
        resolve(res)
      })
      .catch(err => {
        reject(err)
      });
    });
  });
}

function getFileMetadata(fileId) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const params = {
        'fileId': fileId
      };
      
      const drive = google.drive({ version: "v3", auth: auth });
      drive.files.get(params).then(res => resolve(res)).catch(err => reject(err));
    });
  });
}

function getChildren(folderId, pageToken) {
  return (auth => {
    return new Promise((resolve, reject) => {      
      const params = {
        'folderId' : folderId,
        'pageToken': pageToken
      };

      const drive = google.drive({ version: "v2", auth: auth });
      drive.children.list(params).then(res => resolve(res)).catch(err => reject(err));
    });
  });
}

function copyFile(fileid) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const drive = google.drive({ version: "v3", auth: auth });
      const params = {
        "fileId": fileid
      };

      drive.files.copy(params).then(res => resolve(res)).catch(err => reject(err));
    });
  });
}

function patchFile(fileid, filename, addParents, removeParents) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const drive = google.drive({ version: "v2", auth: auth });
      const params = {
        "fileId": fileid,
        "addParents": addParents,
        "removeParents": removeParents,
        "resource": {"title": filename}
      };

      drive.files.patch(params).then(res => resolve(res)).catch(err => reject(err));
    });
  });
}

function getLatestEmployeeClockFileId(auth) {
  return new Promise((resolve, reject) => {
    const fileDic = {
      fileNum: -1,
      fileId: null,
      fileName: null
    }

    getChildren(configReader.getClockInConfig().CURRENT_YEAR_FOLDER_ID, null)(auth).then(async result => {
       for (let i = 0; i < result.data.items.length; i++) {
        const id = result.data.items[i].id;
        try {
          const meta = await getFileMetadata(id)(auth);
          const fileNum = Number(meta.data.name.substr(0, 2));
          if (fileDic.fileNum < fileNum) {
            fileDic.fileNum = fileNum;
            fileDic.fileId = meta.data.id;
            fileDic.fileName = meta.data.name;
          }
        } catch (err) {
          reject(err);
        }
      }
        
      resolve(fileDic);
    }).catch(err => reject(err));
  });
}

function createNewEmployeeClockFile(fileName) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const period = fileName.match(/[0-9]{2}\/[0-9]{2}/g);
      const periodFrom = new Date(new Date(`${new Date(Date.now()).getFullYear}/${period[1]}`).getTime() + new Date('1970-01-02').getTime());
      const periodTo = new Date(periodFrom.getTime() + (new Date('1970-01-14')).getTime());
      const fromMM = ("0" + (periodFrom.getMonth() + 1)).slice(-2);
      const fromDD = ("0" + periodFrom.getDate()).slice(-2);
      const tillMM = ("0" + (periodTo.getMonth() + 1)).slice(-2);
      const tillDD = ("0" + periodTo.getDate()).slice(-2);
      const newNum = ("0" + (Number(fileName.substring(0, 2).trim()) + 1)).slice(-2);
          
      const newFileName = `${newNum} [${fromMM}/${fromDD} - ${tillMM}/${tillDD}] Employee Clock In Table`;
      const clockInConfig = configReader.getClockInConfig()
        
      copyFile(clockInConfig.TEMPLATE_FLIE_ID)(auth).then(result => {
        patchFile(result.data.id, newFileName, clockInConfig.CURRENT_YEAR_FOLDER_ID, clockInConfig.EMPLOYEE_CLOCK_MANAGEMENT_FOLDER_ID)(auth).then(resolve).catch(reject);
      }).catch(reject);
    });
  });
}

function initClockInFile(fileId, periodFrom) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const sheets = google.sheets({ version: "v4", auth });
      sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: `Overview!M2:M2`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [
            [periodFrom]
          ]
        }
      }).then(response => {
        const result = response.data;
        if (1 !== result.updatedCells) throw `${result.updatedCells} updated.`;
        resolve(fileId);
      }).catch(reject);
    });
  });
}

function punchClock(fileId, employeeId, datetime) {
  return (auth => {
    return new Promise((resolve, reject) => {
      const sheets = google.sheets({ version: "v4", auth });
      sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: "Daily Scan Data WH!F4:F"
      }).then((response) => {
        const rows = response.data.values;
        if (!rows.length) {
          console.log("No data found.");
        }

        return rows.length+4;
      }).then(lastRow => {
        return sheets.spreadsheets.values.update({
          spreadsheetId: fileId,
          range: `Daily Scan Data WH!F${lastRow}:G${lastRow}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [
              [employeeId, datetime]
            ]
          }
        });
      }).then(response => {
        const result = response.data;
        if (2 !== result.updatedCells) throw `${result.updatedCells} updated.`;
        resolve(true);
      }).catch(reject);
    });
  });
}

router.get("/punch_employee", function(req, res, next) {
  const usercode = req.query.employee_code;
  const punchDttm = req.query.punch_dttm;
  
  if ((punchDttm || '').length !== 14) {
    res.json({code: 100, status: "DateTime('yyyymmddhhmiss') format is incorrect."});
    return;
  }

  fetch(`http://localhost:3000/user/${usercode}`).then(res => res.json())
  .then(json => {
    if (100 === json.code) {
        res.json({code: 100, status: "Employee id doesn't exist in the system."});
        return;
    }

    authorize().then(auth => {
      const punchDateTime = datetimeUtil.convertDatetimeFormat(punchDttm);
      getLatestEmployeeClockFileId(auth).then(({ fileId, fileName }) => {
        const punchDate = new Date(`${punchDttm.substring(0, 4)}/${punchDttm.substring(4, 6)}/${punchDttm.substring(6, 8)}`);
        const curYear = punchDate.getFullYear();
        const period = fileName.match(/[0-9]{2}\/[0-9]{2}/g);
        let periodTo = new Date(`${curYear}/${period[1]}`);
        if (periodTo < new Date(`${curYear}/${period[0]}`)) periodTo = new Date(`${curYear}/${period[1]}`);

        if (periodTo < punchDate) {
          createNewEmployeeClockFile(fileName)(auth).then(result => {
            const newFileId = result.data.id;
            initClockInFile(newFileId, result.data.title.match(/[0-9]{2}\/[0-9]{2}/g)[0])(auth)
            .then(punchClock(newFileId, usercode, punchDateTime)(auth))
            .then(result => {
              res.send(json);
            }).catch(err => console.log("The API returned an error: " + err));
          }).catch(err => console.log("The API returned an error: " + err));
        } else {
          punchClock(fileId, usercode, punchDateTime)(auth).then(result => {
            res.send(json);
          }).catch(err => console.log("The API returned an error: " + err));
        }
      }).catch(err => console.log("The API returned an error: " + err));
    }).catch(err => console.log("The API returned an error: " + err));
  }).catch(err => console.log("The API returned an error: " + err));
});

module.exports = transactionMgr => {
  mgr = transactionMgr;
  
  // authorize().then(auth => {
  //   getChildren(EMPLOYEE_CLOCK_MANAGEMENT_FOLDER_ID)(auth).then(result => {
  //     result.data.items.forEach(v => {
  //       getFileMetadata(v.id)(auth).then(result => {
  //         console.log(result);
  //       });
  //     });

  //     console.log(result);
  //   });
  // });

  return router;
};
