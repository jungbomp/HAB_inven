'use strict';

const fs = require("fs");
const CONFIG_FILE = 'config.json';
let configObj = null;

const getConfig = type => Object.assign({}, configObj[type]);

const getDBConnectionConfig = () => getConfig('DBConnect');
const getClockInConfig = () => getConfig('ClickIn');
const getOrderFormConfig = () => getConfig('OrderForm');
const getSlackConfig = () => getConfig('SlackAPI');
const getGmailConfig = () => getConfig('Gmail');

}

module.exports = () => {
  if (!configObj) {
    const configFile = fs.readFileSync(CONFIG_FILE);
    configObj = JSON.parse(configFile);
  }

  return {
    getDBConnectionConfig: getDBConnectionConfig,
    getClockInConfig: getClockInConfig,
    getOrderFormConfig: getOrderFormConfig,
    getSlackConfig: getSlackConfig,
    getGmailConfig: getGmailConfig
  };
};