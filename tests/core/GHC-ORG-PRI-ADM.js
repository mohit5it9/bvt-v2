'use strict';

var setupTests = require('../../_common/setupTests.js');

var projectId = null;

var testSuite = 'GHC-ORG-PRI-ADM';
var testSuiteDesc = '- TestSuite for Github Organization, Private project for' +
  ' Admin';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests();
        global.setupGithubAdminAdapter();
        // get private project before starting the tests
        var query = util.format('name=%s', global.GHC_OWNER_PRIVATE_PROJ);
        global.ghcAdminAdapter.getProjects(query,
          function (err, projects) {
            if (err || _.isEmpty(projects))
              return done(new Error(util.format('cannot get project for ' +
                'query: %s, Err: %s', query, err)));
            var project = _.first(projects);
            logger.info(testSuite, 'enabling project with id:', project.id);
            projectId = project.id;
            return done();
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
