'use strict';

var self = setupTests;
module.exports = self;

global.util = require('util');
global._ = require('underscore');
global.async = require('async');

var Logger = require('./logging/logger.js');

// each test starts off as a new process
// this function does necessary setup like getting necessary data
function setupTests(params) {
  global.msName = params.msName;
  process.title = params.msName;

  // setup logger
  global.config = {};
  global.config.logLevel = 'verbose';
  global.logger = Logger();

  /* Env Set */
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.apiToken = process.env.SHIPPABLE_API_TOKEN;

  global.config.githubUrl = 'https://api.github.com';
  global.config.githubToken = params.githubToken;

  global.configPath = process.env.SHIPPABLE_CONFIG_PATH;
  global.githubOwnerAccessToken = process.env.GITHUB_ACCESS_TOKEN_OWNER;

  // fetch any more data needed for tests below
}
