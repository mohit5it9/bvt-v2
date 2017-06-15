
'use strict';

var setupTests = require('../../_common/setupTests.js');

var projectId = null;

var testSuite = 'GHC-ORG-PRI-UNA';
var testSuiteDesc = '- TestSuite for Github Organization, Private project for' +
  ' Unauthenticated User';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests();
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
      }
    );

    it('1. Cannot Enable a private project',
      function (done) {
        var json = {type: 'ci'};
        global.pubAdapter.enableProjectById(projectId, json,
          function (err, project) {
            if (err)
              logger.info(testSuite, err, project);
            assert.strictEqual(err, 401,
              'public user should not be able to enable private project');
            return done();
          }
        );
      }
    );

    it('2. Cannot Synchonize a private project',
      function (done) {
        // enable a project first
        var json = {type: 'ci'};
        global.suAdapter.enableProjectById(projectId, json,
          function (err) {
            assert(!err, 'should be able to enable the project');

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
        global.suAdapter.putProjectById(projectId, json,
          function (err) {
            assert(!err, 'suAdapter unable be able to pause project');

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
