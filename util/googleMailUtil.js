"use strict";

const { google } = require("googleapis");
const googleAuthUtil = require("./googleAuthUtil");
const Base64 = require('js-base64').Base64;

function sendEmail({id, to, subject, message}) {
  return googleAuthUtil.authorize().then(authClient => {
    const mime = [
      `Content-Type: text/plain; charset="UTF-8"\n`,
      `MIME-Version: 1.0\n`,
      `Content-Transfer-Encoding: 7bit\n`,
      `to: ${to}\n`,
      `from: ${id}\n`,
      `subject: =?UTF-8?B?${subject}?= \n\n`,
      message
    ];

    const gmail = google.gmail({ version: "v1", authClient });
    return gmail.users.messages.send({
      'userId': id,
      'resource': {
        'raw': Base64.encode(mime.reduce((acc, cur) => acc.concat(cur))).replace(/\+/g, '-').replace(/\//g, "_")
      },
      auth: authClient
    });
  });
}

module.exports = {
  sendEmail: sendEmail
};
