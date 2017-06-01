'use strict';

var setupTests = require('../../_common/setupTests.js');

var projectId = null;

var testSuite = 'GHC-ORG-PRI-ADM';
var testSuiteDesc = '- TestSuite for Github Organization, Private project for' +
  'Admin';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests();
        global.setupGithubOwnerAdapter();
        // get private project before starting the tests
        var query = util.format('name=%s', global.GHC_OWNER_PRIVATE_PROJ);
        global.ghcOwnerAdapter.getProjects(query,
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
        global.ghcOwnerAdapter.enableProjectById(projectId, json,
          function (err) {
            if (err)
              return done(new Error(util.format('cannot enable private ' +
                'project with id:%s', projectId)));

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
        global.ghcOwnerAdapter.deleteProjectById(projectId, {},
          function (err) {
            if (err) {
              logger.warn(testSuite, 'Cleanup - failed to delete the project');
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
