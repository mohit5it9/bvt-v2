'use strict';

var self = setupTests;
module.exports = self;

var chai = require('chai');
global.assert = chai.assert;

global.util = require('util');
global._ = require('underscore');
global.async = require('async');
global.logger = require('./logging/logger.js')(process.env.LOG_LEVEL);

// each test starts off as a new process, setup required constants
function setupTests() {
  global.config = {};
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.apiToken = process.env.SHIPPABLE_API_TOKEN;

  global.config.githubUrl = 'https://api.github.com';

  global.configPath = process.env.SHIPPABLE_CONFIG_PATH;
  global.githubOwnerAccessToken = process.env.GITHUB_ACCESS_TOKEN_OWNER;

  // setup any more data needed for tests below
}
