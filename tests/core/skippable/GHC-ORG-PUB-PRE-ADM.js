'use strict';

var setupTests = require('../../../../_common/setupTests.js');
var GithubAdapter = require('../../../../_common/github/Adapter.js');
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PUB-PRE-ADM';
var testSuiteDesc = ' - TestSuite for Github Org, pull request of public ' +
  'project for Admin';

describe(testSuite + testSuiteDesc,
  function () {
    var projectId = null;
    var projectFullName = null;
    var runId = null;
    var githubAdapter = null;

    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            githubAdapter = new GithubAdapter(global.githubOwnerAccessToken,
              global.GHC_ENDPOINT);
            global.setupGithubAdminAdapter();

            var bag = {
              who: util.format('%s|before', testSuite)
            };
            async.series(
              [
                getProject.bind(null, bag),
                enableProject.bind(null, bag),
                reopenPR.bind(null, bag)
              ],
              function (err) {
                if (err) {
                  logger.error(testSuite, 'failed to setup tests. err:', err);
                  return done(err);
                }
                return done();
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

      // get public project before starting the tests
      var query = util.format('name=%s', global.GHC_PUBLIC_PROJ);
      global.ghcAdminAdapter.getProjects(query,
        function (err, projects) {
          if (err || _.isEmpty(projects))
            return next(new Error(util.format('cannot get project for ' +
              'query: %s, Err: %s', query, err)));
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
        function (err) {
          if (err)
            return next(new Error(util.format('cannot enable public ' +
              'project with id:%s', projectId)));

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

    function reopenPR(bag, next) {
      var who = bag.who + '|' + reopenPR.name;
      logger.debug(who, 'Inside');

      var query = {
        state: 'all'
      };
      githubAdapter.getPullRequests(projectFullName, query,
        function (err, response) {
          var pullRequest = null;
          var closeOpenPR = new Promise(
            function (resolve, reject) {
              if (_.isEmpty(response)) {
                logger.info('there should be atleast one pull request ' +
                  'available for the project');
                return reject(new Error('no PR found'));
              }

              pullRequest = _.first(response);
              if (pullRequest.state !== 'open')
                return resolve();

              var innerBag = {
                who: util.format('%s|close open PR', testSuite),
                prNumber: pullRequest.number,
                status: 'closed'
              };
              async.series(
                [
                  updatePR.bind(null, innerBag)
                ],
                function (updatePRErr) {
                  if (updatePRErr)
                    return reject(new Error('Cannot close PR'));
                  return resolve();
                }
              );
            }
          );

          closeOpenPR.then(
            function () {
              var innerBag = {
                who: util.format('%s|open PR', testSuite),
                prNumber: pullRequest.number,
                status: 'open'
              };
              async.series(
                [
                  updatePR.bind(null, innerBag)
                ],
                function (updatePRErr) {
                  if (updatePRErr)
                    return next(new Error('Cannot open PR'));
                  return next();
                }
              );
            },
            function () {
              return next(new Error('Failed to close open PR'));
            }
          );
        }
      );
    }

    function updatePR(bag, next) {
      var who = bag.who + '|' + updatePR.name;
      logger.debug(who, 'Inside');

      githubAdapter.updatePullRequest(projectFullName, bag.prNumber, bag.status,
        function (err) {
          if (err) return next(err);
          logger.info('Updated PR status to ' + bag.status);
          return next();
        }
      );
    }

    it('1. Can run PR build for public project',
      function (done) {
        var expBackoff = backoff.exponential({
          initialDelay: 1000, // ms
          maxDelay: 2000 // max retry interval of 2 second
        });
        expBackoff.failAfter(15); // fail after 15 attempts(30 sec)
        expBackoff.on('backoff',
          function (number, delay) {
            logger.info('No PR run for project with id:', projectId, 'yet.',
              'Retrying after ', delay, ' ms');
          }
        );

        expBackoff.on('ready',
          function () {
            var query = util.format('isPullRequest=true&projectIds=%s',
              projectId);
            global.ghcAdminAdapter.getRuns(query,
              function (err, runs) {
                if (err)
                  return done(new Error(util.format('Cannot get builds for ' +
                    'project id: %s, err: %s', projectId, err)));
                if (_.isEmpty(runs)) {
                  expBackoff.backoff();
                } else {
                  runId = _.first(runs).id;
                  expBackoff.reset();
                  return cancelBuild(done);
                }
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
      }
    );

    function cancelBuild(done) {
      global.ghcAdminAdapter.cancelRunById(runId,
        function (err, response) {
          if (err)
            return done(new Error(util.format('Cannot cancel build id: %d ' +
              'for project id: %s, err: %s, %s', runId, projectId, err,
              util.inspect(response))));
          logger.info('Cancelled build');
          return done();
        }
      );
    }

    after(
      function (done) {
        if (projectId)
          global.suAdapter.deleteProjectById(projectId, {},
            function (err, response) {
              if (err) {
                logger.warn(testSuite,
                  util.format('Cleanup-failed to delete the project with id:' +
                    '%s, err: %s, %s', projectId, err, util.inspect(response)
                  )
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
      }
    );
  }
);
