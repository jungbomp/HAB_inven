"use strict";

const { google } = require("googleapis");
const googleAuthUtil = require("./googleAuthUtil");

function createSpreadFile(fileName) {
  return googleAuthUtil.authorize().then(authClient => {
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
  return googleAuthUtil.authorize()
    .then(authClient => google.drive({ version: "v2", auth: authClient }))
    .then(drive => drive.files.get({fileId: fileId}))
    .then(response => response.data);
}

function getChildren(folderId, pageToken) {
  return googleAuthUtil.authorize()
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

  return googleAuthUtil.authorize()
    .then(authClient => google.drive({ version: "v2", auth: authClient }))
    .then(drive => drive.files.patch(params))
    .then(response => response.data);
}

function spreadSheetUpdate({ spreadsheetId, requests }) {
  return googleAuthUtil.authorize()
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
  return googleAuthUtil.authorize()
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
  return googleAuthUtil.authorize()
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
