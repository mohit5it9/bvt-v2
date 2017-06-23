'use strict';

var setupTests = require('../../_common/setupTests.js');
var backoff = require('backoff');

var testSuite = 'RES-ORG-PUB-COL';
var testSuiteDesc = ' - Validate resources for Github Org, public project ' +
  'for Collab';

describe(testSuite + testSuiteDesc,
  function () {
    var githubSubIntId = null;
    var syncRepoResourceId = null;
    var rSyncResourceId = null;
    var projectId = null;
    var projectName = null;
    var runShResourceId = null;
    var buildId = null;
    var subId = null;

    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubCollabAdapter();
            global.setupGithubAdminAdapter();
            var bag = {
              who: testSuite + '|before ',
              subId: null
            };
            async.series(
              [
                getSubscription.bind(null, bag),
                getAccountIntegration.bind(null, bag),
                addGithubSubInt.bind(null, bag),
                getProject.bind(null, bag)
              ],
              function (err) {
                if (err) {
                  logger.error(testSuite, 'failed to create githubSubInt', err);
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

    function getSubscription(bag, next) {
      var who = bag.who + '|' + getSubscription.name;
      logger.debug(who, 'Inside');

      var query = util.format('subscriptionOrgNames=%s',
        global.GITHUB_ORG_NAME);
      global.ghcAdminAdapter.getSubscriptions(query,
        function (err, subscriptions) {
          if (err || _.isEmpty(subscriptions))
            return next(new Error(util.format('unable to get subcription ' +
              'for query: %s, subs: %s', query, util.inspect(subscriptions))));

          subId = _.first(subscriptions).id;
          return next();
        }
      );
    }

    function getAccountIntegration(bag, next) {
      var who = bag.who + '|' + getAccountIntegration.name;
      logger.debug(who, 'Inside');

      var query = util.format('names=%s', 'github');
      global.ghcAdminAdapter.getAccountIntegrations(query,
        function (err, accInts) {
          if (err || _.isEmpty(accInts))
            return next(new Error(util.format('unable to get accountInt ' +
              'for query: %s, accInt: %s', query, util.inspect(accInts))));

          bag.gitHubAccntInt = _.first(accInts);
          return next();
        }
      );
    }

    function addGithubSubInt(bag, next) {
      var who = bag.who + '|' + addGithubSubInt.name;
      logger.debug(who, 'Inside');

      var body = {
        accountIntegrationId: bag.gitHubAccntInt.id,
        subscriptionId: subId,
        name: bag.gitHubAccntInt.name,
        propertyBag: {
          enabledByUserName: global.GITHUB_ORG_NAME,
          accountIntegrationName: bag.gitHubAccntInt.name
        }
      };

      global.ghcAdminAdapter.postSubscriptionIntegration(body,
        function (err, subInt) {
          if (err)
            return next(util.format('Unable to post subInt for' +
              'body: %s, with err: %s, %s', util.inspect(body), err,
              util.inspect(subInt)));

          // add subInt to nconf so it is tracked for cleanup
          githubSubIntId = subInt.id;
          global.saveResource(
            {
              type: 'subInt',
              id: githubSubIntId
            },
            function () {
              return next();
            }
          );
        }
      );
    }

    function getProject(bag, next) {
      var who = bag.who + '|' + getProject.name;
      logger.debug(who, 'Inside');

      var query = util.format('name=%s', global.GHC_PUBLIC_PROJ);
      global.ghcAdminAdapter.getProjects(query,
        function (err, projects) {
          if (err || _.isEmpty(projects))
            return next(new Error(util.format('cannot get project for ' +
              'query: %s, Err: %s, %s', query, err, util.inspect(projects))));
          var project = _.first(projects);
          projectId = project.id;
          projectName = project.name;
          return next();
        }
      );
    }

    it('1. Can add a seed repo',
      function (done) {
        if (!projectId) return done(new Error('project id not found'));
        if (!subId) return done(new Error('subInt id not found'));
        if (!githubSubIntId) return done(new Error('githubSubIntId not found'));

        var resourceName = projectName + '_master';
        var body = {
          resourceName: resourceName,
          projectId: projectId,
          subscriptionId: subId,
          branch: 'master',
          subscriptionIntegrationId: githubSubIntId
        };

        global.ghcCollabAdapter.postNewSyncRepo(body,
          function (err, response) {
            assert(!err, util.format('unable to post new sync repo' +
            ' with body: %s err:%s, %s', body, err, util.inspect(response)));

            var query = util.format('isDeleted=false&subscriptionIds=%s',
              subId);
            global.suAdapter.getResources(query,
              function (e, resources) {
                assert(!e, new Error(util.format('unable to get resources' +
                  ' for query:%s, err, %s, %s', query, err, resources)));

                rSyncResourceId = _.findWhere(resources, {isJob: true}).id;
                assert.isNotNull(rSyncResourceId, 'rSyncReourceId should not' +
                  ' be null.');

                syncRepoResourceId = _.findWhere(resources, {isJob: false}).id;
                assert.isNotNull(syncRepoResourceId, 'syncRepoResourceId ' +
                  'should not be null');
                global.saveResource(
                  {
                    type: 'resource',
                    id: syncRepoResourceId
                  },
                  function () {
                    var syncDone = waitForRSyncToComplete();
                    syncDone.then(
                      function () {
                        return done();
                      },
                      function (_err) {
                        return done(_err);
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );

    function waitForRSyncToComplete() {
      return new Promise(
        function (resolve, reject) {
          var expBackoff = backoff.exponential({
            initialDelay: 1000, // ms
            maxDelay: 2000 // max retry interval of 2 seconds
          });
          expBackoff.failAfter(30); // fail after 30 attempts(~60 sec)
          expBackoff.on('backoff',
            function (number, delay) {
              logger.info('rSync in progress. Retrying after ', delay, ' ms');
            }
          );
          expBackoff.on('ready',
            function () {
              // set account when ready
              var query = util.format('resourceIds=%s', rSyncResourceId);
              global.suAdapter.getBuilds(query,
                function (err, builds) {
                  if (err)
                    return reject(new Error(util.format('Failed to get ' +
                      'builds for query %s with err %s, %s', query, err,
                      builds)));

                  if (_.isEmpty(builds))
                    expBackoff.backoff(); // wait till builds are created

                  // TODO; remove the log later
                  logger.info('got build: ', util.inspect(builds));

                  var build = _.first(builds);
                  var successStatusCode = _.first(_.where(global.systemCodes,
                    {name: 'success', group: 'status'})).code;
                  if (build.statusCode !== successStatusCode) {
                    expBackoff.backoff();
                  } else {
                    expBackoff.reset();
                    return resolve();
                  }
                }
              );
            }
          );

          // max number of backoffs reached
          expBackoff.on('fail',
            function () {
              return reject(new Error('Max number of backoffs reached'));
            }
          );
          expBackoff.backoff();
        }
      );
    }

    it('2. Can trigger job',
      function (done) {
        var bag = {
          who: util.format('%s|can trigger job', testSuite)
        };
        async.series(
          [
            getRunShResource.bind(null, bag),
            triggerBuild.bind(null, bag),
            verifyBuild.bind(null, bag)
          ],
          function (err) {
            if (err)
              return done(new Error(util.format('Cannottrigger build ' +
                'for resource id: %s, err: %s, %s', runShResourceId, err)));
            return done();
          }
        );
      }
    );

    function getRunShResource(bag, next) {
      var who = bag.who + '|' + getRunShResource.name;
      logger.debug(who, 'Inside');

      var runShSystemCode = _.findWhere(global.systemCodes,
        {group: 'resource', name: 'runSh'}).code;
      var query = util.format('isDeleted=false&subscriptionIds=%s&' +
        'isJob=true&typeCodes=%s', subId, runShSystemCode);
      global.suAdapter.getResources(query,
        function (err, resources) {
          if (err || _.isEmpty(resources))
            return next(new Error(util.format('unable to get' +
              ' resources for query:%s, err, %s, %s', query, err,
              resources)));
          runShResourceId = _.first(resources).id;
          return next();
        }
      );
    }

    function triggerBuild(bag, next) {
      var who = bag.who + '|' + triggerBuild.name;
      logger.debug(who, 'Inside');

      global.ghcCollabAdapter.triggerNewBuildByResourceId(runShResourceId, {},
        function (err) {
          return next(err);
        }
      );
    }

    function verifyBuild(bag, next) {
      var expBackoff = backoff.exponential({
        initialDelay: 1000, // ms
        maxDelay: 2000 // max retry interval of 2 second
      });
      expBackoff.failAfter(30); // fail after 30 attempts
      expBackoff.on('backoff',
        function (number, delay) {
          logger.info('No build for resource with id:', runShResourceId, 'yet.',
            'Retrying after ', delay, ' ms');
        }
      );

      expBackoff.on('ready',
        function () {
          var processingStatusCode = _.findWhere(global.systemCodes,
              {group: 'status', name: 'processing'}).code;
          var query = util.format('resourceIds=%s&statusCodes=%s',
            runShResourceId, processingStatusCode);
          global.ghcCollabAdapter.getBuilds(query,
            function (err, builds) {
              if (err)
                return next(new Error(util.format('Cannot get builds for ' +
                  'resource id: %s, err: %s', runShResourceId, err)));
              if (_.isEmpty(builds)) {
                expBackoff.backoff();
              } else {
                buildId = _.first(builds).id;
                expBackoff.reset();
                return next();
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

    it('3. Can cancel job',
      function (done) {
        assert.isNotNull(buildId, 'build should not be null');

        var json = {
          statusCode: _.findWhere(global.systemCodes,
            {group: 'status', name: 'cancelled'}).code
        };
        global.ghcCollabAdapter.putBuildById(buildId, json,
          function (err, response) {
            assert(!err, util.format('cancel build failed for build with ' +
              'id: %s err: %s, %s', buildId, err, util.inspect(response)));
            buildId = null;
            return done();
          }
        );
      }
    );


    it('4. Can soft delete resources',
      function (done) {
        assert.isNotNull(syncRepoResourceId, 'syncRepo should not be null');
        var query = '';
        global.ghcCollabAdapter.deleteResourceById(syncRepoResourceId, query,
          function (err, response) {
            assert(!err, util.format('Cleanup failed to soft delete ' +
              'resource with id: %s err: %s, %s', syncRepoResourceId, err,
              util.inspect(response)));
            return done();
          }
        );
      }

    );

    it('5. Can hard delete resources',
      function (done) {
        assert.isNotNull(syncRepoResourceId, 'syncRepo should not be null');
        var query = 'hard=true';
        global.ghcCollabAdapter.deleteResourceById(syncRepoResourceId, query,
          function (err, response) {
            assert(!err, util.format('Cleanup failed to hard delete ' +
              'resource with id: %s err: %s, %s', syncRepoResourceId, err,
              util.inspect(response)));
            global.removeResource(
              {
                type: 'subInt',
                id: githubSubIntId
              },
              function () {
                syncRepoResourceId = null;
                return done();
              }
            );
          }
        );
      }
    );

    function deleteResource(bag, next) {
      var who = bag.who + '|' + deleteResource.name;

      if (!syncRepoResourceId) return next();
      var innerBag = {who: who};
      async.series(
        [
          softDelete.bind(null, innerBag),
          hardDelete.bind(null, innerBag)
        ],
        function (err) {
          if (err) {
            logger.warn(who, err);
            return next();
          }

          // remove from nconf state if deletion is successful
          global.removeResource(
            {
              type: 'resource',
              id: syncRepoResourceId
            },
            function () {
              return next();
            }
          );
        }
      );
    }

    function softDelete(innerBag, next) {
      var who = innerBag.who + '|' + softDelete.name;
      logger.debug(who, 'Inside');

      var query = '';
      global.suAdapter.deleteResourceById(syncRepoResourceId, query,
        function (err, response) {
          if (err)
            return next(util.format('Cleanup failed to delete ' +
              'resource with id: %s err: %s, %s', syncRepoResourceId, err,
              util.inspect(response)));
          return next();
        }
      );
    }

    function hardDelete(innerBag, next) {
      var who = innerBag.who + '|' + softDelete.name;
      logger.debug(who, 'Inside');

      var query = 'hard=true';
      global.suAdapter.deleteResourceById(syncRepoResourceId, query,
        function (err, response) {
          if (err)
            return next(util.format('Cleanup failed to delete ' +
              'resource with id: %s err: %s, %s', syncRepoResourceId, err,
              util.inspect(response)));

          return next();
        }
      );
    }

    function deleteSubInt(bag, next) {
      var who = bag.who + '|' + deleteSubInt.name;
      logger.debug(who, 'Inside');

      if (!githubSubIntId) return next();

      global.suAdapter.deleteSubscriptionIntegrationById(githubSubIntId,
        function (err, response) {
          if (err) {
            logger.warn(who, util.format('Cleanup-failed to delete the ' +
              'subInt with id: %s, err: %s, %s', githubSubIntId, err,
              util.inspect(response)));
            global.saveResource(
              {
                type: 'subInt',
                id: githubSubIntId
              },
              function () {
                return next();
              }
            );
          } else {
            // remove from nconf state if deletion is successful
            global.removeResource(
              {
                type: 'subInt',
                id: githubSubIntId
              },
              function () {
                return next();
              }
            );
          }
        }
      );
    }

    function cancelBuild(bag, next) {
      if (!buildId) return next();

      var who = bag.who + '|' + deleteResource.name;
      logger.info(who, 'cancelling build with id:', buildId);

      var json = {
        statusCode: _.findWhere(global.systemCodes,
          {group: 'status', name: 'cancelled'}).code
      };

      global.suAdapter.putBuildById(buildId, json,
        function (err, response) {
          if (err)
            logger.warn(util.format('admin failed to cancel build with ' +
              'id: %s err: %s, %s', buildId, err, util.inspect(response)));
          return next();
        }
      );
    }

    after(
      function (done) {
        var who = testSuite + '|after';
        logger.debug(who, 'Inside');

        var bag = {who: who};
        async.series(
          [
            cancelBuild.bind(null, bag),
            deleteResource.bind(null, bag),
            deleteSubInt.bind(null, bag)
          ],
          function (err) {
            if (err)
              logger.warn(who, 'cleanup failed with err: ', err);

            return done();
          }

        );
      }
    );
  }
);
