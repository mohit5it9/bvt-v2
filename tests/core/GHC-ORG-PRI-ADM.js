'use strict';

var setupTests = require('../../_common/setupTests.js');
var backoff = require('backoff');

var projectId = null;
var runId = null;

var testSuite = 'GHC-ORG-PRI-ADM';
var testSuiteDesc = '- TestSuite for Github Organization, Private project for' +
  ' Admin';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubAdminAdapter();
            // get private project before starting the tests
            var query = util.format('name=%s', global.GHC_OWNER_PRIVATE_PROJ);
            global.ghcAdminAdapter.getProjects(query,
              function (err, projects) {
                if (err || _.isEmpty(projects))
                  return done(new Error(util.format('cannot get project for ' +
                    'query: %s, Err: %s', query, err)));
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

    it('1. Can Enable a private project',
      function (done) {
        var json = {
          type: 'ci'
        };
        global.ghcAdminAdapter.enableProjectById(projectId, json,
          function (err) {
            if (err)
              return done(new Error(util.format('cannot enable private ' +
                'project with id:%s', projectId)));

            return done();
          }
        );
      }
    );

    it('2. Can Synchonize a private project',
      function () {
        var projectSynced = new Promise(
          function (resolve, reject) {
            global.ghcAdminAdapter.syncProjectById(projectId,
              function (err, project) {
                if (err)
                  return reject(new Error(util.format('Failed to sync project' +
                    '%s with error: %s', projectId, err)));
                return resolve(project);
              }
            );
          }
        );
        return projectSynced.then(
          function (project) {
            // NOTE: can add more assertions here
            assert.isNotEmpty(project.branches,
              'Project should have branches');
          }
        );
      }
    );

    it('3. Can pause a private project',
      function () {
        var pauseProject = new Promise(
          function (resolve, reject) {
            var json = {propertyBag: {isPaused: true}};
            global.ghcAdminAdapter.putProjectById(projectId, json,
              function (err, project) {
                if (err)
                  return reject(new Error('Cannot pause project'));
                return resolve(project);
              }
            );
          }
        );
        return pauseProject.then(
          function (project) {
            assert.isNotEmpty(project, 'project should not be empty');
            assert.isNotEmpty(project.propertyBag, 'propertyBag should not be'
              + 'empty');
            assert.strictEqual(project.propertyBag.isPaused, true,
              'isPaused should be set to true');
          }
        );
      }
    );

    it('4. Can resume a private project',
      function () {
        var pauseProject = new Promise(
          function (resolve, reject) {
            var json = {propertyBag: {isPaused: false}};
            global.ghcAdminAdapter.putProjectById(projectId, json,
              function (err, project) {
                if (err)
                  return reject(new Error(util.format('Cannot resume project' +
                  'id: %s, err: %s', projectId, err)));
                return resolve(project);
              }
            );
          }
        );
        return pauseProject.then(
          function (project) {
            assert.isNotEmpty(project, 'project should not be empty');
            assert.isNotEmpty(project.propertyBag, 'propertyBag should not be'
              + 'empty');
            assert.strictEqual(project.propertyBag.isPaused, false,
              'isPaused should be set to false');
          }
        );
      }
    );

    it('5. Can trigger manual builds',
      function (done) {
        var triggerBuild = new Promise(
          function (resolve, reject) {
            var json = {type: 'push'};
            global.ghcAdminAdapter.triggerNewBuildByProjectId(projectId, json,
              function (err, response) {
                if (err)
                  return reject(new Error(util.format('Cannot trigger manual build for ' +
                    'project id: %s, err: %s', projectId, err)));
                
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
                logger.info('Run with id:', runId, ' not yet in processing. Retrying after ', delay, ' ms');
              }
            );

            expBackoff.on('ready',
              function () {
                global.ghcAdminAdapter.getRunById(runId,
                  function (err, run) {
                    if (err)
                      return done(new Error('Failed to get run id: %s with err,',
                        runId, err));

                    var processingStatusCode = _.findWhere(global.systemCodes,
                      {group: 'statusCodes', name: 'PROCESSING'}).code;
                    if (run.statusCode === processingStatusCode) {
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

    it('6. Can view builds',
      function (done) {
        var query = util.format('projectIds=%s', projectId);
        global.ghcAdminAdapter.getRuns(query,
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

    it('7. Can cancel build',
      function (done) {
        global.ghcAdminAdapter.cancelRunById(runId,
          function (err, response) {
            if (err)
              return done(new Error(util.format('Cannot cancel build id: %d for ' +
                'project id: %s, err: %s', runId, projectId, err)));
            return done();
          }
        );
      }
    );

    it('8. Can run custom build',
      function (done) {
        var json = {type: 'push', globalEnv: {key: 'value'}};
        global.ghcAdminAdapter.triggerNewBuildByProjectId(projectId, json,
          function (err, response) {
            if (err)
              return done(new Error(util.format('Cannot trigger custom build for ' +
                'project id: %s, err: %s', projectId, err)));
            return done();
          }
        );
      }
    );

    it('9. Can download logs',
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
      global.ghcAdminAdapter.getJobConsolesByJobId(bag.jobId, '',
        function (err, response) {
          if (err)
            return next(new Error(util.format('Cannot get consoles for job id: %s' +
              ', err: %s', bag.jobId, err)));
          bag.logs = response;
          return next();
        }
      );
    }

    it('10. Can Reset a private project',
      function (done) {
        var json = {projectId: projectId};
        global.ghcAdminAdapter.resetProjectById(projectId, json,
          function (err, response) {
            if (err)
              return done(new Error(util.format('Cannot reset project id: %s' +
                ', err: %s', projectId, err)));
            return done();
          }
        );
      }
    );

    it('11. Can Delete a private project',
      function (done) {
        var json = {projectId: projectId};
        global.ghcAdminAdapter.deleteProjectById(projectId, json,
          function (err, response) {
            if (err)
              return done(new Error(util.format('Cannot delete project id: %s' +
                ', err: %s', projectId, err)));
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
