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
function deleteResources(resToClean) {
  var who = scriptName + deleteResources.name + '|';
  // reverse so that newer resources are deleted first
  resToClean.reverse();

  async.eachSeries(resToClean,
    function (resource, next) {
      deleteResourcesMap[resource.type](resource, next);
    },
    function (err) {
      if (err) {
        var uncleanResources = _.filter(resToClean,
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

function deleteProject(projRes, next) {
  var who = scriptName + deleteProject.name + '|';
  var projectId = projRes.id;
  if (!projectId) {
    logger.warn('project id should not be null');
    return next();
  }
  global.suAdapter.deleteProjectById(projectId, {},
    function (err) {
      if (err) {
        logger.error(who, 'failed to delete the project, id:', projectId,
          'err:', err);
      } else {
        logger.info(who, 'deleted project with id: ', projectId);
        deletedResList.push(projRes);
      }
      return next();
    }
  );
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
        logger.error(who, 'failed to delete account. id: ', accountId,
          'err:', err);
      } else {
        logger.info(who, 'deleted account. accountId=', accountId);
        deletedResList.push(accRes);
      }
      return next();
    }
  );
}

setup();
