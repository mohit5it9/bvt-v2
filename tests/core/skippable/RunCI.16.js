'use strict';

var setupTests = require('../../../_common/setupTests.js');
var backoff = require('backoff');

var testSuite = 'RunCI';
var testSuiteDesc = ' - TestSuite for checking services and environment ' +
  'variables ';

describe(testSuite + testSuiteDesc,
  function () {
    var projectId = null;
    var runId = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubAdminAdapter();

            var bag = {who: testSuite + '|before'};
            async.series(
              [
                getProject.bind(null, bag),
                enableProject.bind(null, bag)
              ],
              function (err) {
                if (err)
                  logger.error(testSuite, 'Failed to init tests, err: ', err);
                return done(err);
              }
            );
          },
          function (err) {
            logger.error(testSuite, 'failed to setup tests. err:', err);
            return done(err);
          }
        );
      }
    );

    function getProject(bag, next) {
      var who = bag.who + '|' + getProject.name;
      logger.debug(who, 'Inside');

      var query = util.format('name=%s', global.GHC_CORE_TEST_U14_PROJ);
      global.ghcAdminAdapter.getProjects(query,
        function (err, projects) {
          if (err || _.isEmpty(projects))
            return next(new Error(util.format('cannot get project for ' +
              'query: %s, Err: %s, %s', query, err, projects)));
          var project = _.first(projects);
          projectId = project.id;
          return next();
        }
      );
    }

    function enableProject(bag, next) {
      var who = bag.who + '|' + enableProject.name;
      logger.debug(who, 'Inside');

      var json = {type: 'ci'};
      global.ghcAdminAdapter.enableProjectById(projectId, json,
        function (err) {
          if (err)
            return next(new Error(util.format('cannot enable private ' +
                'project with id:%s', projectId)));
          global.saveResource(
            {
              type: 'project',
              id: projectId
            },
            function () {
              setTimeout(
                function () {
                  console.log('sleeping 5 sec');
                  return next();
                }, 5000
              );
            }
          );
        }
      );
    }

    it('16. Run a build for test common services and env vars',
      function (done) {
        var triggerBuild = new Promise(
          function (resolve, reject) {
            var json = {branchName: 'master'};
            global.ghcAdminAdapter.triggerNewBuildByProjectId(projectId, json,
              function (err, response) {
                if (err)
                  return reject(new Error(util.format('Cannot trigger manual ' +
                    'build for project id: %s, err: %s, %s', projectId, err,
                    util.inspect(response))));

                return resolve(response);
              }
            );
          }
        );
        triggerBuild.then(
          function (response) {
            runId = response.runId;
            var latestStatus = null;
            var successStatusCode = _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'SUCCESS'}).code;
            var completedStatusCodes = [
              _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'FAILED'}).code,
              _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'STOPPED'}).code,
              _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'CANCELED'}).code,
              _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'SKIPPED'}).code,
              _.findWhere(global.systemCodes,
              {group: 'statusCodes', name: 'TIMEOUT'}).code
            ];

            var expBackoff = backoff.exponential({
              initialDelay: 5000, // ms
              maxDelay: 10000 // max retry interval of 5 second
            });
            expBackoff.failAfter(50); // fail after 100 attempts (500 sec)
            expBackoff.on('backoff',
              function (number, delay) {
                logger.info('Run with id:', runId, ' not yet completed. ' +
                  'Retrying after ', delay, ' ms, statusCode: ', latestStatus);
              }
            );

            expBackoff.on('ready',
              function () {
                global.ghcAdminAdapter.getRunById(runId,
                  function (err, run) {
                    if (err)
                      return done(new Error('Failed to get run id: %s, err:',
                        runId, err));

                    latestStatus = run.statusCode;
                    if (run.statusCode === successStatusCode) {
                      expBackoff.reset();
                      runId = null;
                      return done();
                    } else if (_.contains(completedStatusCodes,
                      run.statusCode)) {
                      expBackoff.reset();
                      runId = null;
                      return done('build did not succeed');
                    }
                    return expBackoff.backoff();
                  }
                );
              }
            );

            // max number of backoffs reached
            expBackoff.on('fail',
              function () {
                return done(new Error('Max number of backoffs reached'));
              }
            );

            expBackoff.backoff();
          },
          function (err) {
            return done(err);
          }
        );
      }
    );

    function cancelBuild(bag, next) {
      var who = bag.who + '|' + cancelBuild.name;
      logger.debug(who, 'Inside');

      if (!runId) return next();
      global.suAdapter.cancelRunById(runId,
        function (err, response) {
          if (err)
            logger.warn(bag.who, util.format('Cannot cancel build id: %d ' +
              'for project id: %s, err: %s, %s', runId, projectId, err,
              response));
          logger.info(who, util.format('sleeping %s ms after cancel',
            global.DELETE_PROJ_DELAY));
          setTimeout(
            function () {
              return next();
            }, global.DELETE_PROJ_DELAY
          );
        }
      );
    }

    function deleteProject(bag, next) {
      var who = bag.who + '|' + deleteProject.name;
      logger.debug(who, 'Inside');

      if (!projectId) return next();
      global.suAdapter.deleteProjectById(projectId, {},
        function (err, response) {
          if (err) {
            logger.warn(testSuite,
              util.format('Cleanup-failed to delete the project with id:' +
                '%s, err: %s, %s', projectId, err, util.inspect(response)
              )
            );
            return next();
          }
          global.removeResource(
            {
              type: 'project',
              id: projectId
            },
            function () {
              return next();
            }
          );
        }
      );
    }

    after(
      function (done) {
        var who = testSuite + '|after';
        logger.debug(who, 'Inside');

        var bag = {who: who};
        async.series(
          [
            cancelBuild.bind(null, bag),
            deleteProject.bind(null, bag)
          ],
          function (err) {
            if (err)
              logger.warn(who, 'Failed to cleanup with error err:', err);
            return done();
          }
        );
      }
    );
  }
);
