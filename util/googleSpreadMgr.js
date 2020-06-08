"use strict";

const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

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

// Single instance variable
let oAuth2Client = null;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize() {
  return new Promise((resolve, reject) => {
    if (null === oAuth2Client) {
      fs.readFile(CREDENTIAL_FILE_PATH, (err, content) => {
        if (err) {
          console.log("Error loading client secret file:", err);
          reject();
        }
        // Authorize a client with credentials, then call the Google Sheets API.
        const credentials = JSON.parse(content);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        oAuth2Client = new google.auth.OAuth2(
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
    } else {
      resolve(oAuth2Client);
    }
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

function createSpreadFile(fileName) {
  return authorize().then(authClient => {
    const request = {
      resource: {
        properties: {
          "title" : fileName
        }
      },
      auth: authClient
    };

    const sheets = google.sheets({ version: "v4" });
    return sheets.spreadsheets.create(request)
      .then(response => response.data.spreadsheetId);
  });
}

function getFileMetadata(fileId) {
  return authorize()
    .then(authClient => google.drive({ version: "v2", auth: authClient }))
    .then(drive => drive.files.get({fileId: fileId}))
    .then(response => response.data);
}

function getChildren(folderId, pageToken) {
  return authorize()
    .then(authClient => google.drive({ version: "v2", auth: authClient }))
    .then(drive => drive.children.list({ folderId: folderId, pageToken: pageToken })
    .then(ret => ret.data.items));
}

function patchFile({ fileid, filename, addParents, removeParents } = {}) {
  const params = {
    fileId: fileid,
    addParents: addParents,
    removeParents: removeParents,
    // resource: {"title": filename}
  };

  return authorize()
    .then(authClient => google.drive({ version: "v2", auth: authClient }))
    .then(drive => drive.files.patch(params))
    .then(response => response.data);
}

function spreadSheetUpdate({ spreadsheetId, requests }) {
  return authorize()
    .then(authClient => {
      const params = {
        spreadsheetId: spreadsheetId,
        resource: {
          requests: requests
        },
        auth: authClient
      };
  
      const sheets = google.sheets({ version: "v4" });
      return sheets.spreadsheets.batchUpdate(params)
        .then(response => response.data);
    });
}

function spreadSheetValuesGet({ spreadsheetId, range, }) {
  return authorize()
    .then(authClient => {
      const params = {
        auth: authClient,
        spreadsheetId: spreadsheetId,
        range: range
      }

      const sheets = google.sheets({ version: "v4" });
      return sheets.spreadsheets.values.get(params)
        .then(response => response.data);
    });
}

function spreadSheetValuesUpdate({ spreadsheetId, data }) {
  return authorize()
    .then(authClient => {
      const params = {
        auth: authClient,
        spreadsheetId: spreadsheetId,
        valueInputOption: 'USER_ENTERED',
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: data
        }
      }

      const sheets = google.sheets({ version: "v4" });
      return sheets.spreadsheets.values.batchUpdate(params)
        .then(response => response.data);
    });
}

module.exports = {
  createSpreadFile: createSpreadFile,
  getChildren: getChildren,
  getFileMetadata: getFileMetadata,
  patchFile: patchFile,
  spreadSheetUpdate: spreadSheetUpdate,
  spreadSheetValuesGet: spreadSheetValuesGet,
  spreadSheetValuesUpdate: spreadSheetValuesUpdate,
};
