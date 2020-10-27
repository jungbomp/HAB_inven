"use strict";

const fetch = require("node-fetch");
const express = require("express");
const router = express.Router();

const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { SSL_OP_EPHEMERAL_RSA } = require("constants");

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
        range: `Overview!B2:B2`,
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

function punchClock(fileId, employeeId, datetime){
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

function getList(num) {
  return (auth => {
    return new Promise(async (resolve, reject) => {
      // const sheets = google.sheets({ version: "v4", auth });
      // sheets.spreadsheets.values.get({
      //   spreadsheetId: '15V8zmJbAm6-riaA8EgdatIEyMBLxnskbcnjwZmJ5jpY',
      //   range: `1. Product!G1:G811`,
      //   valueRenderOption: 'FORMULA'
      // }).then((response) => {
      //   const rows = response.data.values;
      //   const set = new Set();
      //   const links = [];
      //   rows.forEach(([row]) => {
      //     const url = row.match(/=hyperlink\("([^"]+)"/i);
      //     if (url && url[1]) {
      //       try {
      //         const id = url[1].split("/")[5];
      //         if (false === set.has(id)) {
      //           links.push(id);
      //           set.add(id);
      //         }
      //       } catch (e) {
      //         console.log(e);
      //       }
      //     }
      //   });

      //   if (!links.length) {
      //     console.log("No data found.");
      //   }

      //   resolve(links);

      //   return links;
      // }).then(async (ids) => {
      const ids = [
        {id: '1T6EydT60aN7crWgceOTE31lmb4UWCWKxie2EeVC4Cjg', title: '1. General Information'}, // 1HCA0024
        {id: '1ZcJ6muMjGdgVgAjHK7OTnTo8Ukyq9U7CPPMHJ40WQLU', title: '1. General Information'}, // 3HCA0008
        {id: '1H4Uqu-ws3UblJzY6BrqHc07viyloN5pe-EINeO-8JTw', title: '1. General Information'}, // 1HCA0025
        {id: '1A4Nq6ibj96sjQ_T9U_GP6obmoRxgKqSQN0AEf7oczX0', title: '1. General Information'}, // 3PAA0001
        {id: '1I_vUMI8xu7f6deOfPpG3k3UJdAqF8ZhrCZCPpxDj1A4', title: '1. General Information'}, // 9WONDERA
        {id: '1lvCQfPlnVyx411Nl5IVhaot8nKJIsIOecA6i4lQzQ5E', title: 'General Information'}, // 1VWA1011
        {id: '1RPCYFMX1yc1aIMIlNP0mtKe_pXgcc7TnCGFnhj2OPRw', title: '1. General Information'}, // 1RPA0001
        {id: '1OzSu5XuhI69AKcC_3eIgANeAGfxt_-mk5cEAifzMljM', title: '1. General Information'}, // 5APA0001
        {id: '1EKBrZd3lFvrViBV3oh_olQvHEZpPq4DBalBZHg98Urk', title: '1. General Information'}, // 1TOA0009
        {id: '12iAGzwpPPeNcvb8lSG9_D5n8xL-Sbj_DYWoczO1prhE', title: '1. General Information'}, // 9MPCODEA
        {id: '1uxQdjXYauHr5XfLCKvk4V56oQwI9z7sPdn4525-Blkw', title: '1. General Information'}, // 5IHA0002
        {id: '1lIe_TG0DLC_Yj0DguDef_m0MYltBz9dCtY4M4TS6gs8', title: '1. General Information'}, // 3IHA0001
        {id: '1cdAP1otvVpK5vp8rvPR6iHBAQPRnUbwkM88o8lJw434', title: '1. General Information'}, // 9KN95A
        {id: '1eEYkA9KeTCPwm9l0ortzIn1fjgW8hCewfPMab5cBAUA', title: '1. General Information'}, // 9DISPOSABLEA
        {id: '1EsIR0HCi1uCzUIMlUFuC_VjIwuNedWv9pM5nqp2TU1M', title: '1. General Information'}, // 3BHA0001
        {id: '19N6d5-1qaK0i1K8IFMgRAi0Ak1SdugGJY6Pde7dtbM4', title: '1. General Information'}, // 3AHA0001
        {id: '1WrFclWvYm3lMnPCzt5kCslMdIHJdRygXemojIewI4H8', title: '1. General Information'}, // 1JDA0007
        {id: '1269W_MwcFA0iJ_dCaZVIBzh1pAoGSGLo-HsARnrgHow', title: '1. General Information'}, // 1JDA0001
        {id: '1xiWabkq2JW08SovryCgAh58XVfqU7jC7O7BbZ1U2AWA', title: '1. General Information'}, // 3HCA0007
        {id: '1ZNdrrfh8vfOGkSyDjWlcNiDzXzYiv9fBoMYT-g1rBQc', title: '1. General Information'}, // 1RAA0001
        {id: '1-lrEjAW6oxzOyHJRy_jK_8VX3my2SSuGI_hQFyRNrGg', title: '1. General Information'}, // 9AROYA
        {id: '1CX6OX3vQSWEWxw6-DzpCXV9xXGe7D8v2HWcYY_KLEr8', title: '1. General Information'}, // 1BHA0004
        {id: '1lcRvExlLhsZeXsdy88ihXfiihxhz_m_HLlYStYaJOlc', title: '1. General Information'}, // 1ABA0024
        {id: '1ighlUQzEmgeQg_Oo8lQu56gxoxaiGbcOjLNjrbD9EZ8', title: '1. General Information'}, // 9IBELIVYUA
        {id: '1CPpNcGUt6p3SjbnV65IEieuxUup-EWi4mS2D8ywYHT8', title: '1. General Information'}, // 9NATUREA
        {id: '1S3HoaODKnE9zmKHtJy8q-qD3_nJi_JyaeLMDsk06EQ8', title: '1. General Information'}, // 1ZNA0001
        {id: '1oku7yzeApLGJrZY8eujNFROj8rMtGqmROm3CDlNXa_A', title: '1. General Information'}, // 9PRETTYA
        {id: '1LAebPywfTRHlh1cJgOynD2DtSkW6e-JGXM4C7XVvMnM', title: '1. General Information'}, // 9UNIKUA
        {id: '1bkR_5gXkR4C2Fzudm9AjgnivazDydTrQwHTqXUFlQMU', title: '1. General Information'},
        {id: '1LSBgbX4aAo2Q3PRnnz_iSUB30O55MvgNKRnQenNv8N8', title: '1. General Information'},
        {id: '1ard0oohABpQ57tQnygbPvggmagmGvA2u059JM_S04Rw', title: '1. General Information'},
        {id: '1TEMh2bsL4cUPW9LABSNvAdjovrvAYpibVsA-sRKfcXY', title: '1. General Information'},
        {id: '1wA4B6jXIYoOo6mIoGkwtmBDZUMqCNW5CjMIguJizl1Y', title: '1. General Information'},
        {id: '1kGSZ2Haav4_C1Y6fbrF0aCe_8AvBP22cYefBNVZR_h4', title: '1. General Information'},
        {id: '1yoJlDFeT1vM2FWu-jVwpyf7Sl8jYPQUdvyCaEnEZtQ4', title: '1. General Information'},
        {id: '1672R8aSVqMioC5tlxft72zjrOLHrAJVOawLGjG4QacA', title: '1. General Information'},
        {id: '1FLwbJUVxQgt2IRAyP4osD8wJN0Gs3xVR3TJKnckJ2fo', title: '1. General Information'},
        {id: '1Ze4Owbtp8hNmsK6GnUFLOQ-6YA_7T1Uq4MeHhMTXVGo', title: '1. General Information'},
        {id: '1t-c_YP4GLvugLcNA9BnryID2rcWMC-XSkzdpMBHzPvE', title: '1. General Information'},
        {id: '1grGTrAaMR6Q6ThkHl3PlQ9c-7pgKIYm3QcVbvHPbZ1g', title: '1. General Information'},
        {id: '1GJdHzbpLMRJE7ct3XO41ugdM1Lsbuc9e0nM1KaM8fMk', title: '1. General Information'},
        {id: '11spE9AFY24tp98ubhIujk916Hstf_inh4NPCfuxbh0A', title: '1. General Information'},
        {id: '1pBjsMIiG_ARW-QjRsrlBX86Es3TFMgEiKwLhubzgZek', title: '1. General Information'},
        {id: '1IcpkTmj_vBfMeIUtWWG7fsTSw0M68Dej_94P-VyuljA', title: '1. General Information'},
        {id: '1LVWmrY5tAEsEWowoH7Tqj4Rg79sfe5QwyuRflT9QGzc', title: '1. General Information'},
        {id: '1nftChzeuM8Etuy59dNkpCpLOH0UOzSiko0VRkduUKvg', title: '1. General Information'},
        {id: '1t4K1Wd9umJs9NFp5vX3Av539xCyVFAQjcbkyjm4aDbI', title: '1. General Information'},
        {id: '1fbzZ6QapEyYBBhUNMvkPLBKYEeC8Yl1VQlOrnlgiNVg', title: '1. General Information'},
        {id: '16zOTlpvnqhJwUam2oNl3u5tqEkhSMuDEnVwPjW1urdg', title: '1. General Information'},
        {id: '17zb2HAUZFXp6JY0cEyRM6Q-XiM82j2TxSMOsu4euSaE', title: '1. General Information'},
        {id: '1pdAhEzAvUlHl7YORqrV0Yf4Zjznz1m6otZ1nAyHXd6I', title: '1. General Information'},
        {id: '1-T-GzCm_40seDTGCGKC5G8mPbvRaJ_FjkGm2xg8gVI8', title: '1. General Information'},
        {id: '1mXHdxwOoBg0zDrnVU5kn18kOPpUH6fb3tr6hcqyMmcM', title: 'General Information'},
        {id: '12_vQkEXlXOPgU9MWZ2s5nqT7hk7lR-T_fZUgz4nqEdw', title: 'General Information'},
        {id: '1NpD0ysQB2PFjyXyoHQqa8Nz_LqatYwEgnIhtBm9mki8', title: '1. General Information'},
        {id: '16MEjV7nPtum6Dm-xupatW0ahALGmh5zp-UoIja5Qh-0', title: '1. General Information'},
        {id: '1dA7tpiE_3gL3pM5BoKv-9zxU2pXragl270RmOEMjAHM', title: '1. General Information'},
        {id: '1jaz33vW70ryDEwlU_k2Ay4kMlOQ0fb_9NNx36X-YcRs', title: '1. General Information'},
        {id: '1bvrWESC-cV-HGTW1doDABkImc9GvuIRGFU1EMg9vJsI', title: '1. General Information'},
        {id: '1w1S3Z72kuT_rUHinmSKyLXsnIgGedz6hvtLK6yZ3cmA', title: '1. General Information'},
        {id: '1b2oExac0iJOawBX1AT7IyhcjRQTX5VYci7XBA7AibSQ', title: 'General Information'},
        {id: '1hhgfo1v8D7jsnSY__ZEU0kJhr2v_6RTNcT_Di7FxQbI', title: '1. General Information'},
        {id: '1PbdxoJLgK0ib3sEKYyi269n8Lr0DTAHl0KfNv20D2Mc', title: '1. General Information'},
        {id: '1hWNQ7wbCNPxquZSvh0HQCn-_X1QkYeGSPWQWmlD2kuw', title: '1. General Information'},
        {id: '1uoKwniHAHDanLy6I4i0EegjIE-l5HHeGP-6w9V3QtvY', title: '1. General Information'},
        {id: '1hPy1ddg0FNHyQW8rwExz8EBfnvvy9HB7aovM4nIn6Gc', title: '1. General Information'},
        {id: '1S0n3j_achpsmRyxP0nZTNNwc67jAkPheuv3U6TeBk1E', title: '1. General Information'},
        {id: '1GREgCZA4kuk8_uY-tMEG_iR8o9c0PlDtxQuJbUpEwHI', title: '1. General Information'},
        {id: '1OQyZ4atrcohMR96hyZK_LDDCo6jN41R-tlKVFq4s0-c', title: '1. General Information'},
        {id: '1iNnk5wOFuSp2KC1UJKgbdE0gvR_aDu_NxxqOHn9p1Gc', title: 'General Information'},
        {id: '1dnNO-6wV9Sx46vKHMMGZ0xaMrqm5A24QTdRz7lYMF04', title: '1. General Information'},
        {id: '17DXNLS0HWdp3_Hwd6fbVWTouyEVuZ9FYRDCZZwypSwI', title: 'General Information'},
        {id: '1Y_SDXYIDeRkoNziCQ_4b61INiA0r1VBeYujspHoPrRk', title: 'General Information'},
        {id: '1y0KzEsb-EfhK-AbsdtlpcFr7RHHwzMIP5wAL3nePBl4', title: 'General Information'},
        {id: '1SMoX43cnXZJ82MyjeZxMCqC_OLIbgi3eT23xO35VG4o', title: '1. General Information'},
        {id: '1xr5-pL2mJErim5mubUdWLAyLhqILdoz0rwqFQjzljYA', title: '1. General Information'},
        {id: '14tFr1YpmYZWSnWfYDtG0tk2PSoPtaZgwEUtr4EL0kxw', title: 'General Information'},
        {id: '1X_WHe_v9CTqK3fnc66JQao9AseRNEIcH4seT0K99dls', title: '1. General Information'},
        {id: '1C1Kq8rvf2-8XJE1-dysxbmC4l8RZ1gPMQe9ETHKjv2A', title: '1. General Information'},
        {id: '10Ygb0WPPkFEBl3xlJgO9X1OFSnX84kmfv-zGpgr_U2Y', title: 'General Information'},
        {id: '1zIlvVZkmmjCExztAGJcC8UMKYLSxX93l4lcue9l7k_U', title: '1. General Information'},
        {id: '13AHfg8uNy4MhwZD8ZhB01_HHdLKQOIjcymsPg9bgVZs', title: 'General Information'},
        {id: '13OGlBD3h72PDgFsR4eSfWHt0SlxvIMQ7ZqQ9lBeARC0', title: '1. General Information'},
        {id: '1udoeGFQg9hPTORg1_Hq-kF4smzMOkfsdtMeD4RpaN4w', title: '1. General Information'},
        {id: '1Kj6LgxMLGS7ezUXMuFVJktZTVhF8hVYJYZO0iEJpWkI', title: '1. General Information'},
        {id: '1NcUzk81FRI6rbS8-fkLae7dRn3s7YaLlitWlxx5qb-0', title: '1. General Information'},
        {id: '1g5dEHg51SZgogPNwV3mPAnfVU3EaGUPNnp0DChvIcQA', title: 'General Information'},
        {id: '1PFdWInMCZl04JseOlXuG5JIIrDtdEuBbpcpN4EbJ-9c', title: 'General Information'},
        {id: '1T279GnDSd6UJQIEem6RgUvxe15uh9t6vWGRK81mMRm8', title: 'General Information'},
        {id: '1VUXNzKLUCEOumW2mFawpXZ8jcl7YVl60P_bhljrS-yE', title: 'General Information'},
        {id: '1B4yM0-jL-xWt1ZLs0fZ3e_hEu7Thrf6Xb5QFccWdh64', title: 'General Information'},
        {id: '1e4Hb36ysht99b9q3SqQUlj1m0uM3Ie-ezNpY8EykoCE', title: '1. General Information'},
        {id: '1W6WqslfD9L--mfxwj_xoUbZPwWmM3Jdv0zu7m8SpgC4', title: '1. General Information'},
        {id: '1rBB40RVTnpTIXpB6pyd7iFC-hviBf74Q7At8cUswp8U', title: '1. General Information'},
        {id: '1hqqquNvFHZ0XNB38kSo38VOD_bymO_QHVhg3l38pixo', title: '1. General Information'},
        {id: '17qWxm5XEFy1tUoXybkjrtg-8cIjq7CpTg1fE0b6txkE', title: '1. General Information'},
        {id: '1QWy0tPwkRmkgw_3Jvn2n_z857pRCe9GFZVcj6yYoliE', title: '1. General Information'},
        {id: '1H5cM-ubyFVzVdzuLKWd3LqGVtz5TcJFxNTDxcHCsxgk', title: '1. General Information'},
        {id: '1J24jKtshz-GN9-jiJ5PHKvpRQwyF5OtwLLkykQagslc', title: 'General Information'},
        {id: '1m321t-DMiqVwViR1JkYMX6hNLcD77rLlit8P9ygtO4Y', title: 'Sheet1'},
        {id: '1jUk6fl466DC1zYYypXqFO-UpP7oFlp3SQHJ2B2nu07Q', title: '1. General Information'},
        {id: '16GZ43E3IFHS6Ne9BPXQoqwQtd8LSuRnS8qYCDI3bNKI', title: '1. General Information'},
        {id: '1Jnvx2STRmPb2CqkDir0VyBbRJTF67QwXk2CfB8WeH1A', title: '1. General Information'},
        {id: '1yXXOiYmSoAG1XbOu9JWq407dC3cPcvySxZWEZGaLT9M', title: '1. General Information'},
        {id: '1f1XKLv1dRnYt3QSYUvWw74UDEgQ8ws0q-A2InJPaJDs', title: '1. General Information'},
        {id: '161fvduKMlH0Q4Q6BHRMgE7sDWQNI8PVe37oFHdP_cyE', title: '1. General Information'},
        {id: '1e4QVc2_LND99MmVQsJLC_1LUaAnJj-AkJR91zpTEtBo', title: '1. General Information'},
        {id: '1-fy6rNXRY7XUYGvsuTI9H2orxrBLMfJpr7dj5E7r4GQ', title: '1. General Information'},
        {id: '1t9fqajN03bUBQaa_pzFyxTJIO_zPr-k6nEI6Xb6gPDg', title: '1. General Information'},
        {id: '1Wq1DGdFQm7Z5yJtELseM3k34eXxrQQiGPu58rs9SWZA', title: '1. General Information'},
        {id: '1DbLTdq9eDPINUIk3qT9wK6u0mDZRwHpY_9dEZsgkjWM', title: 'General Information'},
        {id: '1NXM1wkupWFFsoJzLMdu-FXMyWUT5ZjdT3nGQddzk_iA', title: 'General Information'},
        {id: '1OskQj2sEsSc3i1Vc5wm645fUYxeGZIJXjnYWERYmYvE', title: 'General Information'},
        {id: '12uVucIlM7Jr7XiMRk6vn5gALhJBvdHL2oMCTqbWNX_Q', title: 'General Information'},
        {id: '1Avi_u4mjkvApM0sgWajac2sVZCkywCjzw3-Mv71J9no', title: '1. General Information'},
        {id: '15_r0mnjpcyjl6xO77_cMfsEgKZ9VcfVOALiGyAgXma8', title: '1. General Information'},
        {id: '1cvnLHkkSdnUQzgvCRJ5QfdH7aVk26S1fevakyMETKK0', title: '1. General Information'},
        {id: '1GZa_VolqZ0U0bcvJOYiDO5Kt1vbtTAAtYmP626O12TA', title: '1. General Information'},
        {id: '10u8qYQpQsynkK8ZzDmbxQn4mfZnkJs3iJHlsV8A1-Y4', title: '1. General Information'},
        {id: '1qLOzmlEnL4gm9a-rnLtwMe9a9P_LoZ7OX3ytKG9Ua2o', title: '1. General Information'},
        {id: '1LQW9QXpFPYQ6ZhRK6SMBwAX2pqoeLwqRx1IKnX5MkTg', title: '1. General Information'},
        {id: '18IM_Q_eLH7X6Eykn0297UFzDDXiyAe_rNLjFyX4aq24', title: '1. General Information'},
        {id: '1vhBYR9I-WtsTWC94pmhVpU8RG2Xjg3O4f4VnIvnauwY', title: '1. General Information'},
        {id: '1PXNkhYqTsocGGOCdQtdjXg4zupwPHxu6zpeCk8zIslU', title: '1. General Information'},
        {id: '1aHn_l-X9p10GLAF1lEyY0M7RQrSPpNgx_SQ9q3sw32c', title: '1. General Information'},
        {id: '1nXq2ksyDlZ-oVWbSlbdwUMdWYW8g62XH6Sobhxvqt8E', title: '1. General Information'},
        {id: '1xVZcZkwypgkCKGOocb-1w9r-mXPUphuRwg3ywSQD618', title: 'General Information'},
        {id: '1Yd3LHIGQKmBJ71anGNluf456K-alCJZ94mAbgZQl2uU', title: '1. General Information'},
        {id: '175XQ5lb-kzSS8x-MsYW7w8igWU_3GBHEAk88c3wyIiY', title: '1. General Information'},
        {id: '1tvDEVeyB_QlZeNixniyfq8L2J_Pq6uSBHInTo2eeyT4', title: '1. General Information'},
        {id: '1IJBGmVlTKl-4Me1ssBSQlbwJjsCLvon8VNJptOqIU2A', title: '1. General Information'},
        {id: '1_OilZIRe5DIK62y5xhPcLLVIm-6QgcpLVGMOxpolM5w', title: '1. General Information'},
        {id: '1WPfxTmWyU95lkBcgi7U2rTtvLN2xNjketg7HdEbq45w', title: '1. General Information'},
        {id: '1hkX8_8YHyXiDcNHBuL3cLCdKMiFLepUgW66liuSQnlw', title: '1. General Information'},
        {id: '1lVv6W6VBjJvJGOlf156hO65_Fb9FAfCqKokP1KF-GX8', title: '1. General Information'},
        {id: '1entynJ_JxUzze0c1BepFG8YMC_uUDH9WJPHgfuwIUTg', title: 'General Information'},
        {id: '1hzQTRdT7XUwZ_qUxUi0vFUSgk8twL-_Q-Hht_PxDRuE', title: 'General Information'},
        {id: '1zk0ZX-RIcaa3TQQ9M80SZR6otTf5YXEaC_gwSfbqgdU', title: '1. General Information'},
        {id: '1LrH6VQUpA0-G4UgNewiOX7hGtBjK_QBS25biYGImkpM', title: '1. General Information'},
        {id: '1vshenHvRO6OdR4hf0DmmJZvI1o4QGi3IMgNsyQDuNs4', title: '1. General Information'},
        {id: '1HNIHGS4cyI7dvKckm1JR-joianSAO4PdtYaOdrlp9l8', title: '1. General Information'},
        {id: '1vEF_r1jC8J7iAZplFG4XRhHiMtewYVSmK9Krvivh3vc', title: '1. General Information'},
        {id: '1FLhiq8IrajObFTlNqrzZa75cbYl59MCgbME0Bt6_vcM', title: 'General Information'},
        {id: '1jqRFWg8fsCleoaAstAFtq23OQ0wlORMWZ3HGvnYfL-A', title: 'General Information'},
        {id: '1iETIfMuJ2JnwFKLxw8dzmID-DnrXJSTPcDNO8NhYHM8', title: '1. General Information'},
        {id: '13yJ3gXQ1aXPX2qsN12ZIyrWYW8bkDbRTcbltzr85JW4', title: '1. General Information'},
        {id: '19Ohn-5X9JHYIoNbzU7bsOEkFKVpINtSfPHPOzrQpOvU', title: '1. General Information'},
        {id: '1UCb-p1zPt1JHUnk5StzihcxETyjw8RjWEQG5OkvNAZU', title: '1. General Information'},
        {id: '1iotVZhRh2SkApSL4aYdT1_OULEduA-NniEv83VUqIU0', title: '1. General Information'},
        {id: '1M3Gn7vyB31z2jOpx-o3y09DmZ5___736e0Trgt8UYPA', title: '1. General Information'},
        {id: '1S9giRhzg05pLYQy5Wf65lwx4ryPE2fucZhMi1r56yZk', title: '1. General Information'},
        {id: '1GhCayzDsWWlnIVGmSdbqLIDTJaFj8LAgq-9QgG4Oe_4', title: '1. General Information'},
        {id: '15kdFgiwm7lKlzOQxJ03FflDfPgWAaIpJBplZg8oHjoI', title: '1. General Information'},
        {id: '1eRtJRYGJMYMGwK3sh7tKNc2QvX46a0zJD5-KWhjPtgA', title: '1. General Information'},
        {id: '1iZlkjmkWo9YC9b2_eE5KtDAHDqW3iyeuJXeTU7IwHdQ', title: '1. General Information'},
        {id: '1Iq-9Lv5XoO8zuINwnrkn8EeCBAUYYyn2NtkV7LesNGg', title: '1. General Information'},
        {id: '1DtpC_8c3dYqYTxB-7eBNsIkiHL4JQUqUpU7YU7Ji6EM', title: 'General Information'},
        {id: '1zl4KfQqYSe8gYNjKUHJWywDXI21-cRQeEiaR_rdjTFI', title: '1. General Information'},
        {id: '1Pndde6dd_rgn8lSaVCNz4fkPdlDWtjIx-j40DV_g8o8', title: '1. General Information'},
        {id: '1YZyW7N0ld4JoHCfAC4AD816tVDuEwCtSBDlXUQlNj7c', title: 'General Information'},
        {id: '1laib_3ZvPfvEPsAfvn0fMLAcWqItPF7FhYWlk6LFTfs', title: '1. General Information'},
        {id: '1Xzx3tsUIjCfa8_25gLVUlUkubLEfEFVNhJML2XcgN4k', title: '1. General Information'},
        {id: '1lBhtXdair4-GL3S1F-0XKNJ8aT4Mom7KsOHt_RyY2vA', title: '1. General Information'},
        {id: '1zFjFXlsnAqf_CJbMOXNhGkRXZSh2wf784xTHma7vyOA', title: 'Sheet1'},
        {id: '1sV1O0m2ENm-cEUsy5AFB3CdcdTOj0nUuZBNo2j8hE78', title: '1. General Information'},
        {id: '13Cc16hzr7MY6wiI4nC8QfjdHKBv7QOjex4rdqAojgDQ', title: '1. General Information'},
        {id: '1BSfQcV8Hib1EPPGgcYwWZAxxwPH8yUWM3dSuv4ferfM', title: '1. General Information'},
        {id: '1Ggg6dyusixs9U4pH3X-PGVQQ4EpfybHyNs02E535U9I', title: '1. General Information'},
        {id: '1LgSUDwUAqHzmsvDHM2VNyICyMPZ0Nzylkj2EYJdXf7Y', title: '1. General Information'},
        {id: '11Xc-1g9gMC5KyBqD-f5ANlShi8OThPTsgh36V9XRpWY', title: '1. General Information'},
        {id: '1-Uohr7VzjSywfu0AaGtR5HtnV46XplY4eGq9k0BvaLk', title: '1. General Information'},
        {id: '1uGkTeCOL16pYw9fQkmkmhBuOp0VO8ZEG4zDRyOFUHuc', title: '1. General Information'},
        {id: '1v20q8KgBw8sxtbQT4lmT0IFtF2qdGK7nk1-iqqdu7RE', title: '1. General Information'},
        {id: '1SFNs4tbBNJsDnino3lnRA2Cr6Xkizk5KzRkMjGCyQ9Q', title: '1. General Information'},
        {id: '1hyGGFRTQDK2n3RK7obuIOXeMe6sRH4bRoyipz5fUSvQ', title: '1. General Information'},
        {id: '16tSNnp6h-vTZuSq2VHoeeq5fgaFvE6TdyXM-scKlrC0', title: '1. General Information'},
        {id: '1qojMZkGC3zouPo8k_39BE3L7SBWr0F7o8H6eihfDmVQ', title: '1. General Information'},
        {id: '1UlZ2L1dKGiaSNNj60aCsWWFnG2UmDMY-4dcc-W2eABI', title: '1. General Information'},
        {id: '1RE1QfMRs7ruGWtQccbSgpSDARhhkpxf2_Fscpx-4hrI', title: '1. General Information'},
        {id: '1Mp4lBTyaZDPMyXhRk8bn1MRB43NCRe36JcXYwt-XdBM', title: '1. General Information'},
        {id: '1GzC68MAyxQRAgtqKWvXF8nCOvaMysMkyJHmJBCA7Acg', title: '1. General Information'},
        {id: '1aHUfAYsXOOAvGrtXoAbHnj1gNRLqsMZCTKxLXGLAIJQ', title: '1. General Information'},
        {id: '1wcpP3eTjOVxKZnPsyYhbRmaIyIM86ob0tdwkGCdQ8iQ', title: '1. General Information'},
        {id: '13D4_P7YHKFQyyK7vCCRg9t-kMYkMwq4lgZY1WHMCYn4', title: '1. General Information'},
        {id: '1V4p80wuy4GLAQZXUqiFAB35hEqSJDLlt63gossZyHVc', title: '1. General Information'},
        {id: '18AGAoIjkMT5mqzTWqUT5LqDDh1BEx5iPrjbafM0y3RE', title: '1. General Information'},
        {id: '1m5jhsAExvT06rn7BXkPmjX6A7IvDrByWfC5Ukiqwvuk', title: '1. General Information'},
        {id: '1tBD5ROy27i_UkIQ2TehGi8FeY1Hjx-vyEdtcPTDxI_0', title: '1. General Information'},
        {id: '1ocGOereh9FR4rzEQw14Quala4PV7mlPQd_hFi5UGwNo', title: '1. General Information'},
        {id: '1MgTFO3SMylSIrEiI4Bv2HBJf4R5qc-BdxL2FtBZdyic', title: '1. General Information'},
        {id: '1S7lWn4O0nnMZTdibtJbxrjhPoOUeZ3OXye47HmFwVLA', title: '1. General Information'},
        {id: '1CBW1v-W2A5Nv4eT4qbgh9tBXD27mw7Voni8Kd9msx7I', title: 'General Information'},
        {id: '1uEUchH52d0wY9yKOL-bKvyJ-0emENOLNU8juIPZDN-o', title: '1. General Information'},
        {id: '1cN1xyYpZYyRXOBbkRD53jbuj_fmZtwO-3pNSCsFGpIY', title: 'General Information'},
        {id: '1xrd1j-bFkBvuSuGW6nHF_7Ou42_vJdjDW2XlRIXoNXw', title: '1. General Information'},
        {id: '1vMC7xHMYPec35Nj-9OR5gloO693-klc08nuccie_4l4', title: '1. General Information'},
        {id: '1CyTEOJtA0da3K9NNlgWHYhQcqFuM-PYCNg6xispAUOk', title: '1. General Information'},
        {id: '17JRLdn69DPRV-GkbMFLITH5FFcLpcAbWtSPb8-P6Mbk', title: '1. General Information'},
        {id: '12_1ArSKttFfXhFEMbrxIckOinYLfTqVyC0sFcXVfGXo', title: '1. General Information'},
        {id: '1UvHuQgI-9dsBq8TuoWGG62fKSACR83F4ok7PFmLWrxE', title: '1. General Information'},
        {id: '1Jft2RTA-f5HGtBiShN8K_VF63yGSuVObSMNzJ2oay_o', title: '1. General Information'},
        {id: '19MtHIxSQg1xAvf52G8GmqegsgWEn_JVrWc3o2YHDu9c', title: '1. General Information'},
        {id: '1TwqQwHFaNftxTuWTA17HM9g3ofLEE3OZBbUP8auUXrE', title: 'General Information'},
        {id: '1pZ__QkFWsPuOrwKUjsq5NCr9_gOwZIjQd5vky9SDF7g', title: '1. General Information'},
        {id: '1RWyIHKMlMYTjFpFSbt6sm05VTpoq2wgF86q16acYKo0', title: '1. General Information'},
        {id: '1Totm60wyoo8KEhsGXwPrDh8oF_-xuyu1EbQOd_RE9gA', title: '1. General Information'},
        {id: '10hlk2i8s5MRdD00hzOogi93WCbyi12973OdKW5Mvqeg', title: 'General Information'},
        {id: '1REdeSZnXIIAAY1wATabun239DD_wKmGP1aTkUtK5M3k', title: '1. General Information'},
        {id: '1szePc4ZfQDpxvgZZEVkVCAsiVIECVFYCVC3L5oUMsJo', title: '1. General Information'},
        {id: '1swxBE8BwzWMV2YvshmINgvj7Q7FceFX78oiZcJQBnzY', title: '1. General Information'},
        {id: '1rEz6WKXtHJKzsHD9kv6A3_gZihPeLgTtPu2wDR0NCZw', title: '1. General Information'},
        {id: '1TssHUZw2A9t95lb6zwxzzMP__BnUIJh3PEo5b0CMYPM', title: '1. General Information'},
        {id: '1KPDDCcShhIZ9BPifzpRPE9z30JPTvfc-tKhEAMxDxPs', title: '1. General Information'},
        {id: '1rXxjFi8xlrwGaTlLb650SNjNMT53vQbzWLaAnUO2Oqg', title: '1. General Information'},
        {id: '1QcLhlBxFfhK87qdRVlK5gXa0z9Yu9E15oU14GIZl2aM', title: '1. General Information'},
        {id: '1gU3WwuXGAhBAg9jPnV7i0208IfWHyOrmnQL3b3vb3nU', title: '1. General Information'},
        {id: '1TQucmGyEODa0E0NeR1DGvzum_JEMOwSBCGkLLHl43Ic', title: '1. General Information'},
        {id: '13yGPsZgyeqRmOR8q8ZCOVkoYUFk4W8oS4KzPqHKHwKw', title: '1. General Information'},
        {id: '1ufIgt38R5m4e_b9TGklpsUaxTx_aeTfxEFQPFY2ZDS4', title: '1. General Information'},
        {id: '1m3qmsSPbIpIrikVeiryxtH13ZqS1XcnbcG6RpcMqxyg', title: '1. General Information'},
        {id: '1kzFMkOQflPPtcQamNsktcfJG8rQfaod7gRJjI3XHPBM', title: '1. General Information'},
        {id: '1LPDGxjavkRKb2sQnBoBXV--rysqjjLnnUP34AC3pb6E', title: '1. General Information'},
        {id: '1kJQH6EV0XE_TWwndJxWblR1NBczcq2st8W11vtfUiCo', title: '1. General Information'},
        {id: '1dq-x5Na27dl2HrisKjRlKeWQcgqcO9rkwbwTFq_wWU0', title: '1. General Information'},
        {id: '1rszWfc0YoqfGEDQFDd9sbnNZUXM4ZeEmkrHSVMLZOfI', title: '1. General Information'},
        {id: '1xLzB6M3qRtKi0leyWvEk7pS_L5DXaK27oGLncfg-3qk', title: '1. General Information'},
        {id: '1iWrJhFOQj5txTkfGM6LV7xwEZt0gyuhK2RWQocHK6cc', title: '1. General Information'},
        {id: '1G63gPzexVMUGNZrUrwimfA8NxwF873cNL6QwUQtJUr0', title: '1. General Information'},
        {id: '1RweJ_4pknsjO0mqRkih9K7_PO_Qex2VF9mt8i8exCw4', title: '1. General Information'},
        {id: '1lngf61pFpMjnucUUanJcb9z23HcebFLfdvocURpDwf4', title: '1. General Information'},
        {id: '1eEV0Xd6kNWIjq1UDGL311mUPvq4wCEtelLA-fVICHs0', title: '1. General Information'},
        {id: '1uENsB6Bm9MrhZYg-Stvf4ZQGsYzpkKTtaQQ17rg-crc', title: '1. General Information'},
        {id: '1IdaNFqzniW6TagC92fOBs1iRQW83wZ-74qpMi8TGisA', title: '1. General Information'},
        {id: '1mDoZ3GLx6M8bHmdTdTxsduqBDlNmZo4J5qV3e6nM47Q', title: '1. General Information'},
        {id: '1y9ED27XCHCYsRWaYkoAji7mqJN7jLnvEbvt-qTLDoSU', title: '1. General Information'},
        {id: '1lLNzTeESBPvf_K9AkBGyO7-76pp6aTTs_aCn4NGU1vU', title: '1. General Information'},
        {id: '1eO6ZJBksj3kx0jNx373lGebz-F8FzGqfaaosRzwY_O0', title: '1. General Information'},
        {id: '1OdIx1oS7H5aASH5RSjV6lvDyxPgvYHNs70FNCRzt4vQ', title: '1. General Information'},
        {id: '1ndCAjyFqtOujGjF6aSsQ4cpmj5OpY_0C-v8U5OdFTO0', title: '1. General Information'},
        {id: '1yG36mMx0PSwGZ0YREZayjRhYc7L7cj4xkaE4xnvcFKU', title: '1. General Information'},
        {id: '1EPx-iaDYFuqs-kiVEVLsjUSxctv9CVpB1UwP69dVpx4', title: '1. General Information'},
        {id: '1IrY3uOV6srftwGEuIeC2EXLiwDdYOHtdPyPsY6Cec5g', title: '1. General Information'},
        {id: '1rUqqk5Kxw5XnvfZCygrGbnbRo5vmAgdprtx-U5v3Mwg', title: '1. General Information'},
        {id: '1vYTUYNYdsmYS7jCGZLVLe1ca-MmpCkGtcLJmlHtTNiw', title: '1. General Information'},
        {id: '1esbLPca-I6cC-v67h-2iKmagXzYxoeo2GOuqa9vpLDk', title: '1. General Information'},
        {id: '1Zy5xUH0itTRumqS-C5ixP11bC9aysKh2UCRRxqWctHE', title: '1. General Information'},
        {id: '1znXWWeO_KQ6Ojw6UcFbFTL68QFchY0rqdgylqqL2cvQ', title: '1. General Information'},
        {id: '1YsvNpwyTp2n1lqN9AeybC16CQrsaWXBlGE36af-QWIE', title: '1. General Information'},
        {id: '15CoU7uHl-tJSQrRR-DfSb5YE2ndW8japMIJOdsoIa_4', title: '1. General Information'},
        {id: '1m7e4zpMDIKjLl2sim_J2oPB9DWuCGGZtbieMQ98p47w', title: '1. General Information'},
        {id: '1RiqOImkrCIfdyMRaezg-SLrabmnQFrsVRE3XP_qHB58', title: '1. General Information'},
        {id: '1I9EhZpcct3GpxXAyTym8H1BXenwdH1HY4lfwqeBJM1E', title: '1. General Information'},
        {id: '1kTDYdu-IjIYLeJOxILBHGKi18FJBGShSsmdCQ-eTPhY', title: '1. General Information'},
        {id: '1IVnHMTcVlnn3f101LxLyG2zpqimX2C1nr6myGyuhyqk', title: '1. General Information'},
        {id: '1_JPdAEEE4iNXL5O8x5rvSpAcJdHelNL35_Tt-A4GeWg', title: '1. General Information'},
        {id: '1ra9s4kEv7LSdDXxKzBqDE1ZQRkHtoMKqfUTM7SYdTF4', title: '1. General Information'},
        {id: '1JRfVT86-KilOryZ28HJ0s5EZ0HaTqHwr9SiE1Kdao0E', title: '1. General Information'},
        {id: '1exGYsW1ZVcfYULR_Ai5PfBue_X_enR2xLmZ2cFJChP8', title: '1. General Information'},
        {id: '1xe6rFWlmx7eiJM_r4gHlrsWpRZ_wl18sJIOk4a0wCao', title: '1. General Information'},
        {id: '1H5BXGtPG_o37FBjrBw8OXMSFzBSA9qN_QcoGceSxeMY', title: 'General Information'},
        {id: '1og7ByjW7MX2Uae8eZu3m_kzDzf3qqXlB_ue9RcP3nT0', title: '1. General Information'},
        {id: '1AfRtrm4agalnusXvBe65G3Rt2fMxtu5_GB50rdBDGJY', title: '1. General Information'},
        {id: '15MuXJD8xXtFo5ZMdqw5rcS3-vx9MilRlbEtxh9Ezmqo', title: '1. General Information'},
        {id: '1F9A0akC_Fcw6Spo9js_iVx-IiO0DkU84RzgA5pr2jho', title: '1. General Information'},
        {id: '10oCxJXMvG4xR4ov4LBKsL6nyaA7KFpeYsOZMkswlmTA', title: '1. General Information'},
        {id: '1m_hKwynCCPFJx0Rw-e3dGqn_BH-AKyUb4jzQ6C56MoI', title: '1. General Information'},
        {id: '1M0PorddRLMpi3Ai3Ud53F5KkhFsCQCxQYeqTu310NCA', title: 'General Information'},
        {id: '1QO8i0DNSnFPX24SR4Nfhaid2R-uejA09mF2R0Wce86k', title: '1. General Information'},
        {id: '1czj4RgdyoWwyO8tUmQcU2nWDRDl8MzcApwgAENt2CCM', title: '1. General Information'},
        {id: '1nESyg4YDhIfYZnKFlVePGuXstCNeG0cPmM1ZcqLPsUk', title: '1. General Information'},
        {id: '1siGequ0_TbnJFuYnorc7Egf4G-LBGpaUCBzCTTolTS4', title: '1. General Information'},
        {id: '1EZ2rhFmr7oP65fSVPdBp5cZLQ8QfbBtlZZVIbaynX6s', title: '1. General Information'},
        {id: '1LcGoLwrHlEqUQyFh_YVJX3-IY9OokGLpY0k6SRH32sk', title: '1. General Information'},
        {id: '1-YEOhK0Vy7foM0JTE2YnqSfuo7RdOfOtaxmN1dAKz90', title: '1. General Information'},
        {id: '1vyh63h8AKLiRfqWEnOYFMb5MiEq2Ah8gZzpJRnMt2Us', title: '1. General Information'},
        {id: '1BwBQdkM6YlfSeqUK3jXFaQ8LR3t7-zJJaET3gyL9ISg', title: '1. General Information'},
        {id: '1QyxU8s8VVN6Q-Tlsl8d6YhjWPeDycmWZtJDdwNrJN60', title: '1. General Information'},
        {id: '1FXn88qwraGskSJVg6IyMKKmUcHZLM_6XQ4TXLK7bzeY', title: '1. General Information'},
        {id: '1KANpoPnZ3nuiAr0cvIEX9cKfWSW2zMs2KaZwQ5NTVmk', title: '1. General Information'},
        {id: '1jD-eAPma_jAFoODeFmDrCliPw13W2VlrvuyQuaITkCY', title: '1. General Information'},
        {id: '1Ov-dbgPKmFdO1TgDYNAawqcYTcFxQigByQ5vSXIRdUQ', title: '1. General Information'},
        {id: '1nTxIPl2bw7G0kHGyx6AmAgUJ67EWcJPEruuLg8bhAoE', title: '1. General Information'},
        {id: '1qRJxC9rQZG_4VrQeYG9KqUFaD6dyrjJFaigZuJInzVE', title: '1. General Information'},
        {id: '1b1bs9udPv-Y6xUHMXextUX4xcu_1cqQeWxkXX1k9Afs', title: 'General Information'},
        {id: '1MP50-Us2XowsTHa159-7Il2zJlC3HzkptvsLRpQ-gYY', title: '1. General Information'},
        {id: '1QCCrEYRXLqNpo0_ZipkXkZPBCWhmgis8D09msvu3Rgg', title: '1. General Information'},
        {id: '1fzrIO1DS1bln58FTnK8QqMfK-NjSLTdZDrt2Z4d6UQM', title: '1. General Information'},
        {id: '1Ov_OCGzs7PiXNy0JoXkuMG8IHWJ8a7vB1VtuaBCfa7A', title: '1. General Information'},
        {id: '1cT3nEiC8y31iwfAtWJ8U09qzOr3KSF5laOpvrfV6ktI', title: '1. General Information'},
        {id: '15MIQHgOicijVRvyJ2zeXpOaY0k-0MMWS4kJLu5ntzWQ', title: '1. General Information'},
        {id: '14Kzq5f9GPY_W0_a0vVYShfprUaUXhxRDvbq7bG5fZ2I', title: '1. General Information'},
        {id: '1-Dhue7wel7CVDuaMuflf3HqKWiA_omjKFgSsCti91SY', title: '1. General Information'},
        {id: '12zKiqOntdDaZTDLjNDfUtJJJGl5NSOTGsHi_qWIW2Ng', title: 'General Information'},
        {id: '1MlgqI8zi5guITXxjqV6Sz-lgp_pBglYBx1BpcS7z4zA', title: 'General Information'},
        {id: '1WKCCkl3PC3buQEm0G7Y1fAFGjE2GdEiQNPBm3q-Q5iE', title: 'General Information'},
        {id: '1aOclnCBnKbOw7xiUF-uTRz6wX8qO8Fsm4s_lmO-CZws', title: '1. General Information'},
        {id: '1nqnvL3Y3Gar2B5mjaXhrsL3Gue86JKt0gsGgqcKZLpM', title: '1. General Information'},
        {id: '1RUJheIe0GOy2qLAzMW-GnTdwT7Qgdq1WL39h5pcpwvc', title: 'General Information'},
        {id: '1CkDAGXN-ftEDbHabf0Zg4oG866kDFjquj6A3MLu9MO8', title: '1. General Information'},
        {id: '1E8GN1bp5XDZhEH-Sp4LekCqJrDZ1WnlKHFOYTkmKRwE', title: '1. General Information'},
        {id: '1HFJNL0dnO2OpZikBiZQ5pqwdkDdySx3v1-qwKyV6md8', title: '1. General Information'},
        {id: '1HXVMs_3yOzXUHqjNXtS9nua074mG6hT_LeFKbw720w4', title: '1. General Information'},
        {id: '1KGCTLloB7CGZTlpbOYKWQBeFh7g_0mRQJaw1oBwMM_k', title: '1. General Information'},
        {id: '1M9pVsY_tN0gQVam3UUzMVkWuWI0Xl3igisZqTzY0F4U', title: '1. General Information'},
        {id: '1OW2tk-VRKxmFic86ZnfYaO9tbp47oDys8GKe8DpnvnI', title: '1. General Information'},
        {id: '1QL1CFMqbn06Xnq9ckMK6FduH7MAitz-n_wPv48_wQXg', title: '1. General Information'},
        {id: '1Tl-YRhOQCrOgN2dPcaAWG0Q9VsuEWOaTBU_hxcrBYIk', title: '1. General Information'},
        {id: '1VG8o44mA5Bi1MgjNONYG4tIKgimb0n0-0hC_gRIwBMA', title: '1. General Information'},
        {id: '1_QEoI0jLouHWLDTydTLYojXON0soqFOM1bzcOvphGHE', title: '1. General Information'},
        {id: '1faiEfT8jEgVRtSU1GeF73omIk33vfRplGU5bUQ1l_7M', title: '1. General Information'},
        {id: '1m9ig-yhMRg6NnwLJ0w_jJ7w3DxySp_lZhFSQ1KaI3gs', title: '1. General Information'},
        {id: '1mXOZzwzujxjsAmIeoFT_Gvw-ONuaSZiRuHQJqVgiv4I', title: '1. General Information'},
        {id: '1q_E3yxTJwbbCc_Clz-TyVC-h9FvRv04iK5UssZqNjiw', title: '1. General Information'},
        {id: '1rLJcx4Wv-EodkVqabLRhxcSxRVdAIGqEXxi5prgRorM', title: '1. General Information'},
        {id: '1trF7aUOPQFBTUxJtKdmc4bzCkalEnHShokGSeo-NoTg', title: '1. General Information'},
        {id: '1wPmOM1Z1CDIGGY80v-XbH4yEnrBbM-mMgsTIU9f5yRo', title: '1. General Information'},
        {id: '1zV2lsCWOIU9jh3vykXtTOr5hvL0n9tDygIi8g9xtVck', title: '1. General Information'},
        {id: '1vjHwt-1s9DbaFpkpjPITdhsSJ8IPdgw80HS4v33Zr5g', title: '1. General Information'},
        {id: '1jNwWSMvJNtwB6n1Jex4YvXnrcNQS3d5r5fPoYcfDPYE', title: '1. General Information'},
        {id: '1G_Iaboh4HuWRqMpL58iJR1hbKF_dO6h9E4RY9IBio70', title: 'General Information'},
        {id: '1q8flXNl7F6CyamGhvknVkX743-KbDOiwTOas0uDIhBc', title: '1. General Information'},
        {id: '1kt_Y9J5Y1Horoaj4B9GlWEM50XxXQL784WzvsCcIvmw', title: 'General Information'},
        {id: '1A5X2K_hSFPcAuAwkIS--r4ewTbvsBqaGHMmOr9T2U6Y', title: '1. General Information'},
        {id: '1sTkRfCaK_bVYMMdINgvBNF8lPPrFcFAwF7mWXYnFaDg', title: '1. General Information'},
        {id: '1R_HWRDTOy3v29jPe88ivo0aa8iIcpCrAGE0FL6Uo2Zs', title: '1. General Information'},
        {id: '1mg-TYRa_lGJ6hAFXXvck8Lz0dBMhc4STo2K5CrVubsQ', title: '1. General Information'},
        {id: '1u9YMSXEobnJEM7NYJmbU7uGmp9_u8BMH3XMs4ubUHhU', title: '1. General Information'},
        {id: '1hajwgDRpoE5_etl3F8-GFtl23uqie2zadhmO6KfDdXc', title: '1. General Information'},
        {id: '1Q7xeG2WDoi93imjjho_B_vTdpdGiv3l-gZQk8pStDx0', title: '1. General Information'},
        {id: '1UVykyBG323Z4ncykP_dFW3qUsd16aP-G1KTnBMOm9b8', title: 'General Information'},
        {id: '1f5p_gHS11WufRsck8Oq-H-4C5Juwt_OAmxj3WWvrcM4', title: '1. General Information'},
        {id: '1bIOxOWpCyIAvvZ4dyz1SMT4APflBF3Qi4uikkE8GFMM', title: '1. General Information'},
        {id: '1Hdwwj2BWH-F0aGFlz2UbaVtNKpI_QqU63vlOBzBFnHU', title: '1. General Information'},
        {id: '1zKfYQH3hppYItU4TKVRenXZZ23hgPnky1dbhW-UZuts', title: '1. General Information'},
        {id: '1dYbFKHa--0ynP4vigd1udi4OfxZFEusQ8YTOX3wA7Y4', title: '1. General Information'},
        {id: '1WSJH4K6TJzPzNguDxZbucG3U9l29kaEEsClLa0KS578', title: '1. General Information'},
        {id: '1n87QoH5BmA2iAQ46bHj_BBRLnynP5ynpIfGqcp8sDvo', title: '1. General Information'},
        {id: '1VVJ6HJiA8s21hKGdtDWmaP3Y_xeSPMN8p7Jl858oYqk', title: '1. General Information'},
        {id: '1FmCv2_E4Ax0jnEo0lzqpeLMCBdjJcikFsx1FKnxo-WE', title: '1. General Information'},
        {id: '1zq0Hk9mpNhH9T4CwgwFMJyN1MdEA4rS_v_U1PncGmZQ', title: '1. General Information'}
      ]

      resolve(ids);
      const ret = [];

      const sheets = google.sheets({ version: "v4", auth });
      for (let i = num; i < ids.length; i++) {
        let sku = new Set();
        /* const sssss = await sheets.spreadsheets.get({
          spreadsheetId: ids[i].id,
          // range: "1. General Information"
        });

        console.log(`{id: '${ids[i].id}', title: '${sssss.data.sheets[0].properties.title}'}, - ${i}`);
        // ret.push({id: ids[i], title: sssss.data.sheets[0].properties.title});
        // if (ret.length === 50) {
        //   console.log(ret);
        //   resolve(ret);
        //   break;

        // }

        ids[i].title = sssss.data.sheets[0].properties.title; */

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: ids[i].id,
          range: ids[i].title
        });

        response.data.values.forEach(row => {
          row.forEach(col => {
            if (col.split("-").length === 3) {
              sku.add(col);
            }
          })
        });

        if (sku.size > 0) {
          const skuArray = [...sku];
          let buffer = skuArray[0];
          for (let k = 1; k < skuArray.length; k++) {
            buffer = buffer + '\n' + skuArray[k];
          }

          await fs.appendFile("sku.txt", buffer, function (err) {
            if (err) console.log(err);
            else
              console.log(`${i} with ${ids[i].id}. saved`);
          });
        }

        // await new Promise((resolve) => { setTimeout(resolve, 10000)});
      }
    });
  });
}

router.get("/list", function(req, res, next) {
const num = req.query.list_num;
  authorize().then(auth => {
    getList(num)(auth).then(response => {
      res.json(response);
    });
  });
});

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
