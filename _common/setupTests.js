'use strict';

var self = setupTests;
var nconf = require('nconf');
module.exports = self;

global.util = require('util');
global._ = require('underscore');
global.async = require('async');

// each test starts off as a new process
// this function does necessary setup like getting necessary data
function setupTests(params) {
  global.msName = params.msName;
  process.title = params.msName;
  global.config = {};


  global.config.logLevel = 'verbose';
  require('./logging/logger.js');

  /* Env Set */
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.apiToken = process.env.SHIPPABLE_API_TOKEN;

  global.config.githubUrl = 'https://api.github.com';
  global.config.githubToken = params.githubToken;

  global.configPath = process.env.SHIPPABLE_CONFIG_PATH;

  nconf.argv().env().file({
    file: global.configPath, format: nconf.formats.json
  });
  nconf.load();
  // fetch any data needed for tests
}
