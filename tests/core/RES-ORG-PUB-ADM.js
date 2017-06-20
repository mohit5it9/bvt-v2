'use strict';

var setupTests = require('../../_common/setupTests.js');

var testSuite = 'RES-ORG-PUB-ADM';
var testSuiteDesc = ' - TestSuite for Github Org, public project for Admin';

describe(testSuite + testSuiteDesc,
  function () {
    var githubSubIntId = null;
    var syncRepoResourceId = null;
    var rSyncResourceId = null;
    var projectId = null;
    var projectName = null;
    var subId = null;

    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubAdminAdapter();
            // setup tests
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

          logger.debug('Added subscription integration');
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

      var query = util.format('name=%s', global.GHC_PRIVATE_PROJ);
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
       // TODO: add meaningful error here
        if (!projectId) return done(true);
        if (!subId) return done(true);
        if (!githubSubIntId) return done(true);

        var resourceName = projectName + '_master';
        var body = {
          resourceName: resourceName,
          projectId: projectId,
          subscriptionId: subId,
          branch: 'master',
          subscriptionIntegrationId: githubSubIntId
        };

        global.ghcAdminAdapter.postNewSyncRepo(body,
          function (err, response) {
            assert(!err, new Error(util.format('unable to post new sync repo' +
            ' with body: %s err:%s, %s', body, err, util.inspect(response))));
            logger.debug('Added resource');

            var query = util.format('isDeleted=false&subscriptionIds=%s',
              subId);
            global.suAdapter.getResources(query,
              function (e, resources) {
                assert(!e, new Error(util.format('unable to get resources' +
                  ' for query:%s, err, %s, %s', query, err, resources)));

                rSyncResourceId = _.first(
                  _.where(resources, {isJob: true})).id;
                assert.isNotNull(rSyncResourceId, 'rSyncReourceId should not' +
                  ' be null.');

                syncRepoResourceId = _.first(
                  _.where(resources, {isJob: false})).id;
                assert.isNotNull(syncRepoResourceId, 'syncRepoResourceId ' +
                  'should not be null');
                global.saveResource(
                  {
                    type: 'resource',
                    id: syncRepoResourceId
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

    it('2. rSync should finish syncing',
      function (done) {
        // TODO: add backoff logic here
        logger.info(testSuite, 'sleeping for 10 seconds');
        setTimeout(
          function () {
            return done();
          }, 10000 // 10 seconds
        );
      }
    );

    function deleteResource(bag, next) {
      var who = bag.who + '|' + deleteResource.name;

      if (!syncRepoResourceId)
        return next('Failed to find syncRepoResouceId');
      var innerBag = {who: who};
      async.series(
        [
          softDelete.bind(null, innerBag),
          hardDelete.bind(null, innerBag)
        ],
        function (err) {
          if (err)
            return next(err);

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

    after(
      function (done) {
        var who = testSuite + '|after';
        logger.debug(who, 'Inside');
        // remove resource and githubSubInt
        // delete project
        var bag = {who: who};
        async.series(
          [
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
