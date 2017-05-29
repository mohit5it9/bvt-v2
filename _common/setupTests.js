'use strict';

var self = setupTests;
module.exports = self;

var chai = require('chai');
global.assert = chai.assert;
global.util = require('util');
global._ = require('underscore');
global.async = require('async');
global.logger = require('./logging/logger.js')(process.env.LOG_LEVEL);
var ShippableAdapter = require('../_common/shippable/Adapter.js');

// each test starts off as a new process, setup required constants
function setupTests() {
  global.config = {};
  global.TIMEOUT_VALUE = 0;
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.githubUrl = 'https://api.github.com';

  global.configPath = process.env.SHIPPABLE_CONFIG_PATH ||
    process.cwd() + '/config.json';
  global.githubOwnerAccessToken = process.env.GITHUB_ACCESS_TOKEN_OWNER;

  global.suAdapter = new ShippableAdapter(process.env.SHIPPABLE_API_TOKEN);
  // init public adapter
  global.pubAdapter = new ShippableAdapter('');

  // setup any more data needed for tests below
}
