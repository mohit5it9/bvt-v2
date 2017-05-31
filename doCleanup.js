'use strict';

var nconf = require('nconf');
var fs = require('fs');
var setupTests = require('./_common/setupTests.js');

var deleteResourcesMap = {
  account: deleteAccount,
  project: deleteProject
};

var scriptName = 'doCleanup|';
var resourcesToClean = null;
var deletedResList = [];
var oldConfigPath = '';

// loads old nconf and cleans up all the resources
function setup() {
  var who = scriptName + setup.name + '|';
  logger.info(who, 'cleaning up tests');
  setupTests();

  oldConfigPath = process.env.JOB_PREVIOUS_STATE + '/resources.json';
  if (!fs.existsSync(oldConfigPath)) {
    logger.warn(who, 'Skipping cleanup as no previous resource file was found');
    return;
  }

  nconf.file({file: oldConfigPath, format: nconf.formats.json});
  nconf.load();
  resourcesToClean = nconf.get('BVT_RESOURCES');

  if (!_.isEmpty(resourcesToClean))
    deleteResources(resourcesToClean);
}

// resources should be saved in following format
// {resource_type: '', id:''}
// eg: {resource_type: 'account', id:'5212302983409238042'}
function deleteResources(resourcesToClean) {
  var who = scriptName + deleteResources.name + '|';
  // reverse so that newer resources are deleted first
  resourcesToClean.reverse();

  async.eachSeries(resourcesToClean,
    function (resource, next) {
      deleteResourcesMap[resource.type](resource, next);
    },
    function (err) {
      if (err) {
        var uncleanResources = _.filter(resourcesToClean,
          function (obj) { return !_.findWhere(deletedResList, obj); }
        );
        var msg = util.format('failed to cleanup resources :( ! Please'
          + 'cleanup following resouces manually: %s',
          util.inspect(uncleanResources));
        logger.error(who, msg);
      }
      logger.info(who, 'cleaning success. deleting resources file');
      global.clearResources(oldConfigPath);
    }
  );
}

function deleteProject(projRes) {
  var who = scriptName + deleteProject.name + '|';
  logger.warn(who, 'To implement');
}

function deleteAccount(accRes, next) {
  var who = scriptName + deleteAccount.name + '|';
  var accountId = accRes.id;
  if (!accountId) {
    logger.warn('account id should not be null');
    return next();
  }

  global.suAdapter.deleteAccountById(accountId,
    function (err) {
      if (err) {
        logger.error(who, 'failed to delete account. err:', err);
      } else {
        logger.info(who, 'deleted account. accountId=', accountId);
        deletedResList.push(accRes);
      }
      return next();
    }
  );
}

setup();
