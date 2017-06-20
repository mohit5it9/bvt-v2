'use strict';

var setupTests = require('../../_common/setupTests.js');
var GithubAdapter = require('../../_common/github/Adapter.js');
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PRI-COL';
var testSuiteDesc = ' - TestSuite for Github Org, pull request of private ' +
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
            async.series(
              [
                init,
                enableProject,
                reopenPR
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

    function init(next) {
      githubAdapter = new GithubAdapter(global.githubOwnerAccessToken,
        global.GHC_ENDPOINT);
      global.setupGithubAdminAdapter();
      // get private project before starting the tests
      var query = util.format('name=%s', global.GHC_OWNER_PRIVATE_PROJ);
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

    function enableProject(next) {
      var json = {
        type: 'ci'
      };
      global.ghcAdminAdapter.enableProjectById(projectId, json,
        function (err) {
          if (err)
            return next(new Error(util.format('cannot enable private ' +
              'project with id:%s', projectId)));

          logger.info('Enabled project');
          return next();
        }
      );
    }

    function reopenPR(next) {
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

              updatePR(pullRequest, 'closed',
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
              updatePR(pullRequest, 'open', next);
            },
            function () {
              return next(new Error('Failed to close open PR'));
            }
          );
        }
      );
    }

    function updatePR(pr, status, callback) {
      githubAdapter.updatePullRequest(projectFullName, pr.number, status,
        function (err) {
          if (err) return callback(err);
          logger.info('Updated PR status to ' + status);
          return callback();
        }
      );
    }

    it('1. Can run PR build for private project',
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
              response)));
          logger.info('Cancelled build');
          return done();
        }
      );
    }

    it('2. Can rerun PR builds',
      function (done) {
        var json = {projectId: projectId, runId: runId};
        global.ghcAdminAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            if (err)
              return done(new Error(util.format('Cannot rerun PR build ' +
                'for project id: %s, err: %s, %s', projectId, err, response)));
            return done();
          }
        );
      }
    );

    // do cleanup of all the resources. if cleanup fails, resource will
    // be tracked in nconf
    after(
      function (done) {
        // delete project
        if (projectId)
          global.ghcAdminAdapter.deleteProjectById(projectId, {},
            function (err) {
              if (err) {
                logger.warn(testSuite, 'Cleanup-failed to delete the project');
                global.saveResource(
                  {
                    type: 'project',
                    id: projectId
                  },
                function () {
                  return done();
                }
              );
              } else {
                return done();
              }
            }
        );
      }
    );
  }
);
