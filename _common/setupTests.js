'use strict';

var self = setupTests;
module.exports = self;

var chai = require('chai');
var fs = require('fs');
global.assert = chai.assert;
global.util = require('util');
global._ = require('underscore');
global.async = require('async');
global.logger = require('./logging/logger.js')(process.env.LOG_LEVEL);
var nconf = require('nconf');
var ShippableAdapter = require('../_common/shippable/Adapter.js');

// each test starts off as a new process, setup required constants
function setupTests() {
  global.config = {};
  global.TIMEOUT_VALUE = 0;
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.githubUrl = 'https://api.github.com';

  global.resourcePath = process.env.JOB_STATE + '/resources.json';
  global.githubOwnerAccessToken = process.env.GITHUB_ACCESS_TOKEN_OWNER;
  global.githubCollabAccessToken = process.env.GITHUB_ACCESS_TOKEN_COLLAB;

  global.suAdapter = new ShippableAdapter(process.env.SHIPPABLE_API_TOKEN);
  global.pubAdapter = new ShippableAdapter(''); // init public adapter

  // setup any more data needed for tests below
  global.ownerProjectsNum = 1;
  global.GITHUB_COLLAB_API_TOKEN_KEY = 'githubCollabApiToken';
  global.GITHUB_OWNER_API_TOKEN_KEY = 'githubOwnerApiToken';

  global.GHC_OWNER_PRIVATE_PROJ = 'testprivate';
  global.GHC_COLLAB_PRIVATE_PROJ = 'testprivate';
}

// if no param given, it reads from nconf
global.setupGithubCollabAdapter = function (apiToken) {
  nconf.file(global.resourcePath);
  nconf.load();
  if (apiToken) {
    nconf.set(global.GITHUB_COLLAB_API_TOKEN_KEY, apiToken);
    nconf.save(
      function (err) {
        if (err) {
          logger.error('Failed to save account info to nconf. Exiting...');
          process.exit(1);
        }
      }
    );
  } else {
    apiToken = nconf.get(global.GITHUB_COLLAB_API_TOKEN_KEY);
  }

  global.ghcCollabAdapter = new ShippableAdapter(apiToken);
};

// if no param given, it reads from nconf
global.setupGithubOwnerAdapter = function (apiToken) {
  nconf.file(global.resourcePath);
  nconf.load();
  if (apiToken) {
    nconf.set(global.GITHUB_OWNER_API_TOKEN_KEY, apiToken);
    nconf.save(
      function (err) {
        if (err) {
          logger.error('Failed to save account info to nconf. Exiting...');
          process.exit(1);
        }
      }
    );
  } else {
    apiToken = nconf.get(global.GITHUB_OWNER_API_TOKEN_KEY);
  }

  global.ghcOwnerAdapter = new ShippableAdapter(apiToken);
};

// NOTE: if state is not forwarded properly in case bvt gets stuck,
//       use s3 to save the state instead of $JOB_PREVOUS_STATE
global.saveResource = function (resource, done) {
  nconf.file(global.resourcePath);
  nconf.load();
  global.nconfRes = nconf.get('BVT_RESOURCES') || [];
  global.nconfRes.push(resource);

  nconf.set('BVT_RESOURCES', global.nconfRes);
  nconf.save(
    function (err) {
      if (err) {
        logger.error('Failed to save account info to nconf. Exiting...');
        process.exit(1);
      } else {
        return done();
      }
    }
  );
};

global.clearResources = function () {
  var who = 'global.clearResources|';
  var nconfFile = global.resourcePath;
  if (!nconfFile) {
    logger.warn(who, 'no nconf file specified to clear');
    return;
  }

  fs.exists(nconfFile,
    function (exists) {
      if (exists) {
        logger.info(who, 'delete nconf resource file: ', nconfFile);
        fs.unlink(nconfFile);
      } else {
        logger.info(who, 'no file found so not deleting');
      }
    }
  );
};
