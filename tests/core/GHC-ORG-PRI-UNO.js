
'use strict';

var setupTests = require('../../_common/setupTests.js');
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PRI-UNO';
var testSuiteDesc = ' - TestSuite for Github Org, public project for' +
  ' Unauthorized Users';

describe(testSuite + testSuiteDesc,
  function () {
    var runId = null;
    var projectId = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            // use a member adapter to simulate unauthorized user signed up
            // on Shippable
            global.setupGithubMemberAdapter();
            global.setupGithubAdminAdapter();
            var bag = {
              projects: null
            };

            // NOTE: logic below can  be simplified by fetching project
            // directly by adminAdapter
            async.series(
              [
                getSubscription.bind(null, bag),
                getProject.bind(null, bag)
              ],
              function (err) {
                if (err) {
                  logger.error(testSuite, 'failed to setup tests. err:', err);
                  return done(err);
                }
                projectId = bag.projectId;
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

    // get sub id for shiptest-github-organization-1
    function getSubscription(bag, next) {
      var query = '';
      global.ghcMemberAdapter.getSubscriptions(query,
        function (err, subs) {
          if (err) {
            logger.error('failed to get subscription for query %s, err %s',
              query, err);
            return next(true);
          }
          var filteredSub = _.filter(subs,
            function (sub) {
              return sub.orgName === 'shiptest-github-owner';
            }
          );
          if (!_.isEmpty(filteredSub))
            bag.subscriptionId = _.first(filteredSub).id;
          return next();
        }
      );
    }

    function getProject(bag, next) {
      // get private project before starting the tests
      var query = util.format('name=%s&subscriptionIds=%s',
        global.GHC_MEMBER_PRIVATE_PROJ, bag.subscriptionId);
      global.ghcMemberAdapter.getProjects(query,
        function (err, projects) {
          if (err || _.isEmpty(projects)) {
            util.format('cannot get project for query: %s, Err: %s',
              query, err);
            return next(err);
          }

          bag.projectId = _.first(projects).id;
          return next();
        }
      );
    }

    it('13. CANNOT Enable a public project',
      function (done) {
        var json = {
          type: 'ci'
        };
        global.ghcMemberAdapter.enableProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, 'uauthorized user cannot enable ' +
              'a project, err:', err, response);
            return done();
          }
        );
      }
    );

    it('14. Can Synchonize a public project',
      function (done) {
        var json = {type: 'ci'};
        global.ghcAdminAdapter.enableProjectById(projectId, json,
          function (err, response) {
            assert(!err, util.format('admin should be able to enable the ' +
              'project got err: %s, %s', err, response));

            global.ghcMemberAdapter.syncProjectById(projectId,
              function (e, project) {
                assert(!e, util.format('Failed to sync project' +
                    '%s with error: %s, project: %s', projectId, e, project));
                assert.isNotEmpty(project, 'Project should not be empty');
                assert.isNotEmpty(project.branches,
                  'Project should have branches');
                return done();
              }
            );
          }
        );
      }
    );

    it('15. CANNOT pause a public project',
      function (done) {
        var json = {propertyBag: {isPaused: true}};
        global.ghcMemberAdapter.putProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, 'unauthorized user shouldnt be ' +
              'able to pause project, err: %s', err, response);
            return done();
          }
        );
      }
    );

    it('16. CANNOT resume a public project',
      function (done) {
        // first enable using su adapter
        var json = {propertyBag: {isPaused: true}};
        global.ghcAdminAdapter.putProjectById(projectId, json,
          function (err) {
            if (err)
              return done('adminAdapter unable be able to pause project');
            json = {propertyBag: {isPaused: false}};

            // try resume if enable is success
            global.ghcMemberAdapter.putProjectById(projectId, json,
              function (e, response) {
                assert.strictEqual(e, 404, util.format('Unauthorized user ' +
                  ' cannot resume projectId: %s, err: %s', projectId, e,
                  response));
                return done();
              }
            );
          }
        );
      }
    );

    it('17. CANNOT trigger manual builds',
      function (done) {
        var json = {branchName: 'master'};
        global.ghcMemberAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('should not trigger ' +
              'manual build for project id: %s, err: %s, %s', projectId, err,
              response));
          }
        );
        // start exp backoff to trigger new build request for other tests
        var triggerBuild = new Promise(
          function (resolve, reject) {
            global.ghcAdminAdapter.triggerNewBuildByProjectId(projectId, json,
              function (err, response) {
                if (err)
                  return reject(new Error(util.format('Cannot trigger manual ' +
                    'build for project id: %s, err: %s, %s', projectId, err,
                    response)));

                return resolve(response);
              }
            );
          }
        );
        triggerBuild.then(
          function (response) {
            runId = response.runId;

            var expBackoff = backoff.exponential({
              initialDelay: 100, // ms
              maxDelay: 1000 // max retry interval of 1 second
            });
            expBackoff.failAfter(30); // fail after 30 attempts
            expBackoff.on('backoff',
              function (number, delay) {
                logger.info('Run with id:', runId, ' not yet in processing. ' +
                  'Retrying after ', delay, ' ms');
              }
            );

            expBackoff.on('ready',
              function () {
                global.ghcMemberAdapter.getRunById(runId,
                  function (err, run) {
                    if (err)
                      return done(new Error('Failed to get run id: %s, err:',
                        runId, err));

                    var processingStatusCode = _.findWhere(global.systemCodes,
                      {group: 'statusCodes', name: 'PROCESSING'}).code;
                    if (run.statusCode !== processingStatusCode) {
                      expBackoff.backoff();
                    } else {
                      expBackoff.reset();
                      return done();
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
          },
          function (err) {
            logger.warn(testSuite, 'error while triggering build:', err);
            return done(err);
          }
        );
      }
    );

    it('18. Can view builds for public project',
      function (done) {
        var query = util.format('projectIds=%s', projectId);
        global.ghcMemberAdapter.getRuns(query,
          function (err, builds) {
            if (err)
              return done(new Error(util.format('Cannot get builds for ' +
                'project id: %s, err: %s', projectId, err)));
            // check if build triggered in previous test case is present
            assert.strictEqual(_.contains(_.pluck(builds, 'id'), runId), true);
            return done();
          }
        );
      }
    );

    it('19. Can view consoles',
      function (done) {
        var bag = {
          runId: runId,
          logs: []
        };
        async.series([
          getJobs.bind(null, bag),
          getLogs.bind(null, bag)
        ],
          function (err) {
            assert.isNotEmpty(bag.logs, 'logs not found');
            return done(err);
          }
        );
      }
    );

    function getJobs(bag, next) {
      var query = util.format('runIds=%s', bag.runId);
      global.ghcMemberAdapter.getJobs(query,
        function (err, response) {
          if (err || _.isEmpty(response))
            return next(new Error(util.format('Cannot find jobs for run' +
              ' id: %s, err: %s', bag.runId, err)));
          bag.jobId = _.first(_.pluck(response, 'id'));
          return next();
        }
      );
    }

    function getLogs(bag, next) {
      global.ghcMemberAdapter.getJobConsolesByJobId(bag.jobId, '',
        function (err, response) {
          if (err)
            return next(new Error(util.format('Cannot get consoles for ' +
              'job id: %s, err: %s, %s', bag.jobId, err, response)));
          bag.logs = response;
          return next();
        }
      );
    }

    it('10. CANNOT cancel builds for public project',
      function (done) {
        global.ghcMemberAdapter.cancelRunById(runId,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('Cannot cancel build  ' +
              'id: %d for project id: %s, err: %s, %s', runId, projectId, err,
              response));
            return done();
          }
        );
      }
    );

    it('21. CANNOT run custom build',
      function (done) {
        var json = {branchName: 'master', globalEnv: {key: 'value'}};
        global.ghcMemberAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('Cannot trigger custom ' +
              'build for project id: %s, err: %s, %s', projectId, err,
              response));
            return done();
          }
        );
      }
    );

    it('22. CANNOT reset cache',
      function (done) {
        var json = {
          propertyBag: {
            cacheTag: 0,
            cacheResetDate: Date.now()
          }
        };
        global.ghcMemberAdapter.putProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('Unauthorized user ' +
              ' should not reset cache project id: %s, err: %s, %s',
              projectId, err, response));
            return done();
          }
        );
      }
    );

    it('23. CANNOT Reset a public project',
      function (done) {
        var json = {projectId: projectId};
        global.ghcMemberAdapter.resetProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('Unauthorized user ' +
              'should not reset project id: %s, err: %s, %s', projectId, err,
              response));
            return done();
          }
        );
      }
    );

    it('24. CANNOT Delete a public project',
      function (done) {
        var json = {projectId: projectId};
        global.ghcMemberAdapter.deleteProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 404, util.format('Unauthorized user ' +
              'should not delete project id: %s, err: %s, %s', projectId, err,
              response));
            return done();
          }
        );
      }
    );

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
