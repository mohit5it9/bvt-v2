
'use strict';

var setupTests = require('../../_common/setupTests.js');
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PRI-UNA';
var testSuiteDesc = ' - TestSuite for Github Org, private project for' +
  ' Unauthenticated User';

describe(testSuite + testSuiteDesc,
  function () {
    var runId = null;
    var projectId = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubAdminAdapter();
            // get private project for owner before starting the tests
            var query = util.format('name=%s', global.GHC_OWNER_PRIVATE_PROJ);
            global.ghcAdminAdapter.getProjects(query,
              function (err, projects) {
                if (err || _.isEmpty(projects)) {
                  logger.warn(util.format('cannot get project for ' +
                    'query: %s, Err: %s', query, err));
                  return done(true);
                }
                var project = _.first(projects);
                projectId = project.id;
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

    it('1. Cannot Enable a private project',
      function (done) {
        var json = {type: 'ci'};
        global.pubAdapter.enableProjectById(projectId, json,
          function (err, project) {
            assert.strictEqual(err, 401, util.format('public user should ' +
              ' not be able to enable private project. err : %s %s',
              err, project));
            return done();
          }
        );
      }
    );

    it('2. Cannot Synchonize a private project',
      function (done) {
        // enable a project first
        var json = {type: 'ci'};
        global.ghcAdminAdapter.enableProjectById(projectId, json,
          function (err) {
            assert(!err, 'admin should be able to enable the project');

            global.pubAdapter.syncProjectById(projectId,
              function (e) {
                assert.strictEqual(e, 404,
                  'public user should not be able to sync a project');
                return done();
              }
            );
          }
        );
      }
    );

    it('3. Cannot pause a private project',
      function (done) {
        var json = {propertyBag: {isPaused: true}};
        assert.isNotNull(projectId, 'Should have an enabled project');
        global.pubAdapter.putProjectById(projectId, json,
          function (err) {
            assert.strictEqual(err, 401,
              'public user cannot pause a private project');
            return done();
          }
        );
      }
    );

    it('4. Cannot resume a private project',
      function (done) {
        // first enable using su adapter
        var json = {propertyBag: {isPaused: true}};
        global.ghcAdminAdapter.putProjectById(projectId, json,
          function (err) {
            assert(!err, 'admin unable be able to pause project');

            json = {propertyBag: {isPaused: false}};
            global.pubAdapter.putProjectById(projectId, json,
              function (e) {
                assert.strictEqual(e, 401,
                  'public user should not be able to resume a project');
                return done();
              }
            );
          }
        );
      }
    );

    it('5. CANNOT trigger manual builds',
      function (done) {
        var json = {type: 'push'};
        global.pubAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 401, util.format('should not trigger ' +
              'manual build for project id: %s, err: %s', projectId, err,
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
                    'build for project id: %s, err: %s', projectId, err)));

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
                global.ghcAdminAdapter.getRunById(runId,
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
            return done(err);
          }
        );
      }
    );

    it('6. CANNOT view builds for private project',
      function (done) {
        var query = util.format('projectIds=%s', projectId);
        global.pubAdapter.getRuns(query,
          function (err, builds) {
            assert.strictEqual(err, 404, util.format('Should not get builds ' +
              'for project id: %s, err: %s, %s', projectId, err, builds));
            // check if build triggered in previous test case is present
            return done();
          }
        );
      }
    );

    it('7. CANNOT view consoles',
      function (done) {
        var bag = {
          runId: runId,
          logs: []
        };
        async.series([
          getJobsByPublicUser.bind(null, bag),
          getJobsByAdmin.bind(null, bag),
          getLogs.bind(null, bag)
        ],
          function (err) {
            return done(err);
          }
        );
      }
    );
    function getJobsByPublicUser(bag, next) {
      var query = util.format('runIds=%s', bag.runId);
      global.pubAdapter.getJobs(query,
        function (err, response) {
          assert.strictEqual(err, 404, util.format('Public user should not ' +
            'find jobs for run id: %s, err: %s, %s', bag.runId, err, response));
          return next();
        }
      );
    }

    function getJobsByAdmin(bag, next) {
      var query = util.format('runIds=%s', bag.runId);
      global.ghcAdminAdapter.getJobs(query,
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
      global.pubAdapter.getJobConsolesByJobId(bag.jobId, '',
        function (err, response) {
          assert.strictEqual(err, 404, util.format('public user should not ' +
            'get consoles for job id: %s, err: %s, %s', bag.jobId, err,
            response));
          return next();
        }
      );
    }

    it('8. CANNOT cancel builds for private project',
      function (done) {
        global.pubAdapter.cancelRunById(runId,
          function (err, response) {
            assert.strictEqual(err, 401, util.format('Cannot cancel build  ' +
              'id: %d for project id: %s, err: %s, %s', runId, projectId, err,
              response));
            return done();
          }
        );
      }
    );

    it('9. CANNOT run custom build',
      function (done) {
        var json = {type: 'push', globalEnv: {key: 'value'}};
        global.pubAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 401, util.format('Cannot trigger custom ' +
              'build for project id: %s, err: %s, %s', projectId, err,
              response));
            return done();
          }
        );
      }
    );

    // TODO: 10. Cannot reset cache

    it('11. CANNOT Reset a private project',
      function (done) {
        var json = {projectId: projectId};
        global.pubAdapter.resetProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 401, util.format('public user should not ' +
                'reset project id: %s, err: %s, %s', projectId, err, response));
            return done();
          }
        );
      }
    );

    it('12. CANNOT Delete a private project',
      function (done) {
        var json = {projectId: projectId};
        global.pubAdapter.deleteProjectById(projectId, json,
          function (err, response) {
            assert.strictEqual(err, 401, util.format('public user should not ' +
              'delete project id: %s, err: %s, %s', projectId, err,
              response));
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
          global.suAdapter.deleteProjectById(projectId, {},
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
