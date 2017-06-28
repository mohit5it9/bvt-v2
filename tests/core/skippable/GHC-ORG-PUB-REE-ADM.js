'use strict';

var setupTests = require('../../../_common/setupTests.js');
var GithubAdapter = require('../../../_common/github/Adapter.js');
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PUB-REE-ADM';
var testSuiteDesc = ' - TestSuite for Github Org, public project release ' +
  'build for admin';

describe(testSuite + testSuiteDesc,
  function () {
    var projectId = null;
    var projectFullName = null;
    var runId = null;
    var tag = null;
    var githubAdapter = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            var who = testSuite + '|before';
            logger.debug(who, 'Inside');

            githubAdapter = new GithubAdapter(global.githubOwnerAccessToken,
              global.GHC_ENDPOINT);
            global.setupGithubAdminAdapter();

            var bag = {
              who: who
            };
            async.series(
              [
                getProject.bind(null, bag),
                enableProject.bind(null, bag),
                enableReleaseBuild.bind(null, bag)
              ],
              function (err) {
                if (err)
                  logger.warn('done async series, err: ', err);
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

      var query = util.format('name=%s', global.GHC_PRIVATE_PROJ);
      global.ghcAdminAdapter.getProjects(query,
        function (err, projects) {
          if (err || _.isEmpty(projects))
            return next(util.format('cannot get project for ' +
              'query: %s, Err: %s, response: %s', query, err,
              util.inspect(projects)));
          var project = _.first(projects);
          projectId = project.id;
          projectFullName = project.fullName;
          return next();
        }
      );
    }

    function enableProject(bag, next) {
      var who = bag.who + '|' + enableProject.name;
      logger.debug(who, 'Inside');

      var json = {
        type: 'ci'
      };
      global.ghcAdminAdapter.enableProjectById(projectId, json,
        function (err, response) {
          if (err)
            return next(util.format('cannot enable private ' +
              'project with id: %s, response: %s', projectId,
              util.inspect(response)));
          global.saveResource(
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

    function enableReleaseBuild(bag, next) {
      var who = bag.who + '|' + enableReleaseBuild.name;
      logger.debug(who, 'Inside');

      var json = {
        propertyBag: {enableReleaseBuild: true}
      };
      global.ghcAdminAdapter.putProjectById(projectId, json,
        function (err, response) {
          if (err)
            return next(util.format('cannot enable release build for ' +
              'project with id: %s, response: %s', projectId,
              util.inspect(response)));
          return next();
        }
      );
    }

    it('1. Can trigger a run through release',
      function (done) {
        var bag = {who: testSuite + '|1|'};
        async.series(
          [
            createRelease.bind(null, bag),
            verifyBuild.bind(null, bag)
          ],
          function (err) {
            if (err) {
              logger.warn(bag.who, 'done async, err: ', err);
              return done(new Error(util.format('Cannot create release for ' +
                'project id: %s, err: %s', projectId, err)));
            }
            return done();
          }

        );
      }
    );

    function createRelease(bag, next) {
      var who = bag.who + '|' + createRelease.name;
      logger.debug(who, 'Inside');

      tag = new Date().toISOString().replace(/[-.:]/g, '/') + '/release';
      githubAdapter.createRelease(projectFullName, tag, 'master', tag, tag,
        false, false,
        function (err, response) {
          if (err) return next(new Error(util.format('Failed to create ' +
            'release with error: %s, response: %s', err,
            util.inspect(response))));
          logger.info('Created release with name: ' + tag);
          return next();
        }
      );
    }

    // exp backoff and check if the build got triggered
    function verifyBuild(bag, next) {
      var who = bag.who + '|' + verifyBuild.name;
      logger.debug(who, 'Inside');

      var expBackoff = backoff.exponential({
        initialDelay: 1000, // ms
        maxDelay: 2000 // max retry interval of 2 second
      });
      expBackoff.failAfter(15); // fail after 15 attempts(30 sec)
      expBackoff.on('backoff',
        function (number, delay) {
          logger.info('No release build for project with id:', projectId,
            'yet.', 'Retrying after ', delay, ' ms');
        }
      );

      expBackoff.on('ready',
        function () {
          var query = util.format('isRelease=true&projectIds=%s',
            projectId);
          global.ghcAdminAdapter.getRuns(query,
            function (err, runs) {
              if (err)
                return next(new Error(util.format('Cannot get builds for ' +
                  'project id: %s, err: %s, response: %s', projectId, err,
                  util.inspect(runs))));
              if (_.isEmpty(runs)) {
                expBackoff.backoff();
              } else {
                runId = _.first(runs).id;
                expBackoff.reset();
                return cancelBuild(next);
              }
            }
          );
        }
      );

      // max number of backoffs reached
      expBackoff.on('fail',
        function () {
          return next(new Error('Max number of backoffs reached'));
        }
      );

      expBackoff.backoff();
    }

    function cancelBuild(next) {
      global.ghcAdminAdapter.cancelRunById(runId,
        function (err, response) {
          if (err)
            return next(new Error(util.format('Cannot cancel build id: %d ' +
              'for project id: %s, err: %s, %s', runId, projectId, err,
              util.inspect(response))));
          logger.info('Cancelled build');
          return next();
        }
      );
    }

    after(
      function (done) {
        if (projectId) {
          logger.info('Sleeping for 15sec as cancelled builds can post ' +
            'consoles till 2min');
          setTimeout(
            function () {
              global.suAdapter.deleteProjectById(projectId, {},
                function (err, response) {
                  if (err) {
                    logger.warn(testSuite,
                      util.format('Cleanup-failed to delete ' +
                      'the project id: %s, err: %s, response: %s', projectId,
                      err, util.inspect(response))
                    );
                    return done();
                  }
                  global.removeResource(
                    {
                      type: 'project',
                      id: projectId
                    },
                    function () {
                      return done();
                    }
                  );
                }
              );
            }, global.DELETE_PROJ_DELAY
          );
        }
      }
    );
  }
);
