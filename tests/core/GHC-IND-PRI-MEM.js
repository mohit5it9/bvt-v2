'use strict';

var setupTests = require('../../_common/setupTests.js');

var projectId = null;

var testSuite = 'GHC-IND-PRI-MEM';
var testSuiteDesc = '- TestSuite for Github Individual, Private project for' +
  ' Member';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);

    before(
      function (done) {
        setupTests();
        global.setupGithubMemberAdapter();
        var bag = {
          projects: null
        };

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

    it('1. Can Enable a private project',
      function (done) {
        var json = {
          type: 'ci'
        };
        global.ghcMemberAdapter.enableProjectById(projectId, json,
          function (err) {
            assert.isNotNull(err, 'should throw error');
            return done();
          }
        );
      }
    );

    it('2. Can Synchonize a private project',
      function () {
        // TODO: enable a project and then try to sync
        var projectSynced = new Promise(
          function (resolve, reject) {
            global.ghcMemberAdapter.syncProjectById(projectId,
              function (err, project) {
                if (err)
                  return reject(util.format('Failed to sync project' +
                    '%s with error: %s', projectId, err));
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
      function (done) {
        var json = {propertyBag: {isPaused: true}};
        global.ghcMemberAdapter.putProjectById(projectId, json,
          function (err, project) {
            if (!err)
              return done('shouldnt be able to pause project');
            return done();
          }
        );
      }
    );

    it('4. Can resume a private project',
      function (done) {
        // first enable using su adapter
        var json = {propertyBag: {isPaused: true}};
        global.suAdapter.putProjectById(projectId, json,
          function (err, project) {
            if (err)
              return done('suAdapter unable be able to pause project');
            json = {propertyBag: {isPaused: false}};

            // try resume if enable is success
            global.ghcMemberAdapter.putProjectById(projectId, json,
              function (err, project) {
                if (!err)
                  return done(util.format('Member cannot resume project' +
                  'id: %s, err: %s', projectId, err));
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
