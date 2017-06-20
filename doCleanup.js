'use strict';

var nconf = require('nconf');
var fs = require('fs');
var setupTests = require('./_common/setupTests.js');

var deleteResourcesMap = {
  account: deleteAccount,
  project: deleteProject,
  subInt: deleteSubInt,
  resource: deleteResource
};

var scriptName = 'doCleanup|';
var resourcesToClean = null;
var deletedResList = [];
var oldConfigPath = '';

// loads old nconf and cleans up all the resources
function setup() {
  var who = scriptName + setup.name + '|';
  logger.info(who, 'cleaning up tests');
  setupTests().then(
    function () {
      oldConfigPath = process.env.JOB_PREVIOUS_STATE + '/resources.json';
      if (!fs.existsSync(oldConfigPath)) {
        logger.warn(who, 'Skipping cleanup as no previous resource file' +
          ' was found');
        return;
      }

      nconf.file({file: oldConfigPath, format: nconf.formats.json});
      nconf.load();
      resourcesToClean = nconf.get('BVT_RESOURCES');

      if (!_.isEmpty(resourcesToClean))
        deleteResources(resourcesToClean);
    },
    function (err) {
      logger.error(who, 'failed to setup tests with err: ', err);
      process.exit(1);
    }
  );
}

// resources should be saved in following format
// {resource_type: '', id:''}
// eg: {resource_type: 'account', id:'5212302983409238042'}
function deleteResources(resToClean) {
  var who = scriptName + deleteResources.name + '|';
  logger.debug(who, 'Inside');

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
  logger.debug(who, 'Inside');

  var projectId = projRes.id;
  if (!projectId) {
    logger.warn(who, 'project id should not be null');
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
  var who = scriptName + deleteAccount.name;
  logger.debug(who, 'Inside');

  var accountId = accRes.id;
  if (!accountId) {
    logger.warn(who, 'account id should not be null');
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

function deleteSubInt(subIntRes, next) {
  var who = scriptName + deleteSubInt.name;
  logger.debug(who, 'Inside');

  var subIntId = subIntRes.id;
  if (!subIntId) {
    logger.warn(who, 'account id should not be null');
    return next();
  }

  global.suAdapter.deleteSubscriptionIntegrationById(subIntId,
    function (err, response) {
      if (err) {
        logger.error(who, util.format('failed to subInt id: %s, err: %s, %s',
          subIntId, err, util.inspect(response)));
      } else {
        logger.info(who, 'deleted subInt. subInt=', subIntId);
        deletedResList.push(subIntId);
      }
      return next();
    }
  );
}

function deleteResource(res, next) {
  var who = scriptName + deleteResource.name;
  logger.debug(who, 'Inside');

  var resId = res.id;
  if (!resId) {
    logger.warn(who, 'resource id should not be null');
    return next();
  }

  var innerBag = {
    who: who,
    syncRepoResourceId: resId
  };
  async.series(
    [
      softDelete.bind(null, innerBag),
      hardDelete.bind(null, innerBag)
    ],
    function (err) {
      if (err)
        logger.warn(who, util.format('failed to delete resource with id:%s' +
        ' with err: %s', resId, err));
      else
        logger.info(who, 'successfully deleted resource with id: ', resId);
      return next();
    }
  );
}

function softDelete(innerBag, next) {
  var who = innerBag.who + '|' + softDelete.name;
  logger.debug(who, 'Inside');

  var query = '';
  global.suAdapter.deleteResourceById(innerBag.syncRepoResourceId, query,
    function (err, response) {
      if (err)
        return next(util.format('Cleanup failed to delete ' +
          'resource with id: %s err: %s, %s', innerBag.syncRepoResourceId, err,
          util.inspect(response)));
      return next();
    }
  );
}

function hardDelete(innerBag, next) {
  var who = innerBag.who + '|' + softDelete.name;
  logger.debug(who, 'Inside');

  var query = 'hard=true';
  global.suAdapter.deleteResourceById(innerBag.syncRepoResourceId, query,
    function (err, response) {
      if (err)
        return next(util.format('Cleanup failed to delete resource ' +
          'with id: %s err: %s, %s', innerBag.syncRepoResourceId, err,
          util.inspect(response)));

      return next();
    }
  );
}
setup();
