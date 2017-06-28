'use strict';

var setupTests = require('../../../_common/setupTests.js');
var spawn = require('child_process').spawn;
var backoff = require('backoff');

var testSuite = 'GHC-ORG-PRI-TAG-ADM';
var testSuiteDesc = ' - TestSuite for Github Org, private project tag ' +
  'build for admin';

describe(testSuite + testSuiteDesc,
  function () {
    var projectId = null;
    var runId = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            var who = testSuite + '|before';
            logger.debug(who, 'Inside');

            global.setupGithubAdminAdapter();

            var bag = {
              who: who
            };
            async.series(
              [
                getProject.bind(null, bag),
                enableProject.bind(null, bag),
                enableTagBuild.bind(null, bag)
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

    function enableTagBuild(bag, next) {
      var who = bag.who + '|' + enableTagBuild.name;
      logger.debug(who, 'Inside');

      var json = {
        propertyBag: {enableTagBuild: true}
      };
      global.ghcAdminAdapter.putProjectById(projectId, json,
        function (err, response) {
          if (err)
            return next(util.format('cannot enable tag build for ' +
              'project with id: %s, response: %s', projectId,
              util.inspect(response)));
          return next();
        }
      );
    }

    it('1. Can trigger a run through tag',
      function (done) {
        var bag = {who: testSuite + '|1|'};
        async.series(
          [
            runTagScript.bind(null, bag),
            verifyBuild.bind(null, bag)
          ],
          function (err) {
            if (err) {
              logger.warn(bag.who, 'done async, err: ', err);
              return done(new Error(util.format('Cannot create tag for ' +
                'project id: %s, err: %s', projectId, err)));
            }
            return done();
          }

        );
      }
    );

    function runTagScript(bag, next) {
      var who = bag.who + '|' + runTagScript.name;
      logger.debug(who, 'Inside');

      var childEnv = global.process.env;
      childEnv.PROJ_NAME = global.GHC_PRIVATE_PROJ;
      childEnv.ORG_NAME = global.GITHUB_ORG_NAME;
      var child = spawn('scripts/create_tag.sh', {env: childEnv});

      child.stdout.on('data',
        function (data) {
          var str = '' + data; // converts output to string
          str = str.replace(/\s+$/g, ''); // replace trailing newline & space
          console.log(str);
        }
      );
      child.on('close',
        function (code) {
          if (code > 0) {
            logger.error(who, util.format('%s failed to create tag', code));
            return next('failed to create tag');
          }
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
          logger.info('No tag build for project with id:', projectId, 'yet.',
            'Retrying after ', delay, ' ms');
        }
      );

      expBackoff.on('ready',
        function () {
          var query = util.format('isGitTag=true&projectIds=%s',
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
        if (projectId)
          global.suAdapter.deleteProjectById(projectId, {},
            function (err, response) {
              if (err) {
                logger.warn(testSuite,
                  util.format('Cleanup-failed to delete ' +
                  'the project id: %s, err: %s, response: %s', projectId, err,
                  util.inspect(response))
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
