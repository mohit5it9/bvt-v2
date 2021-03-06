'use strict';

// login tests for collab

var setupTests = require('../../_common/setupTests.js');
var backoff = require('backoff');

var testSuite = 'ACCT-GHC-COL-IND';
var testSuiteDesc = ' - TestSuite for Github Collab for login';

describe(testSuite + testSuiteDesc,
  function () {
    var account = {};
    var githubSysIntId = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            var query = 'masterName=githubKeys&name=auth';
            global.suAdapter.getSystemIntegrations(query,
              function (err, systemIntegrations) {
                if (err) {
                  assert.isNotOk(err, 'get Github sysInt failed with err');
                  return done(true);
                }

                var gitSysInt = _.first(systemIntegrations);
                assert.isOk(gitSysInt,
                  'No system integration found for github');
                assert.isOk(gitSysInt.id, 'Github sysIntId should be present');
                githubSysIntId = gitSysInt.id;
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

    it('1. Login should generate API token',
      function (done) {
        var json = {
          accessToken: global.githubCollabAccessToken
        };
        global.pubAdapter.postAuth(githubSysIntId, json,
          function (err, body, res) {
            assert.isNotEmpty(res, 'Result should not be empty');
            assert.strictEqual(res.statusCode, 200, 'statusCode should be 200');
            assert.isNotEmpty(body, 'body should not be null');
            assert.isNotNull(body.apiToken, 'API token should not be null');

            account.githubCollabApiToken = body.apiToken;
            account.collabId = body.account.id;
            global.setupGithubCollabAdapter(body.apiToken);

            return done(err);
          }
        );
      }
    );

    it('2. Login account should finish syncing',
      function () {
        var accountSynced = new Promise(
          function (resolve, reject) {
            var expBackoff = backoff.exponential({
              initialDelay: 100, // ms
              maxDelay: 5000 // max retry interval of 5 seconds
            });
            expBackoff.failAfter(30); // fail after 30 attempts
            expBackoff.on('backoff',
              function (number, delay) {
                logger.info('Account syncing. Retrying after ', delay, ' ms');
              }
            );

            expBackoff.on('ready',
              function () {
                // set account when ready
                var query = util.format('accountIds=%s', account.collabId);
                global.suAdapter.getAccounts(query,
                  function (err, accounts) {
                    if (err)
                      return reject(new Error('Failed to get account with err',
                        err));

                    var acc = _.first(accounts);
                    if (acc.isSyncing !== false ||
                      !acc.lastSyncStartDate) {
                      expBackoff.backoff();
                    } else {
                      expBackoff.reset();
                      return resolve(acc);
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
        return accountSynced.then(
          function (acc) {
            assert.isNotEmpty(acc, 'account should not be empty');
          }
        );
      }
    );

    it('3. Login - should sync projects',
      function () {
        var getProjects = new Promise(
          function (resolve, reject) {
            global.ghcCollabAdapter.getProjects('',
              function (err, projects) {
                if (err)
                  return reject(new Error('Unable to get projects with error',
                    err));
                return resolve(projects);
              }
            );
          }
        );
        return getProjects.then(
          function (projects) {
            // TODO : check if a list of projects be checked to make the
            //        test more narrow. should also run locally
            assert.isNotEmpty(projects, 'Projects should not be empty');
          }
        );
      }
    );

    it('4. Login - should create subscriptions',
      function () {
        var getSubs = new Promise(
          function (resolve, reject) {
            global.ghcCollabAdapter.getSubscriptions('',
              function (err, projects) {
                if (err)
                  return reject(new Error('Unable to get subs with error',
                    err));
                return resolve(projects);
              }
            );
          }
        );
        return getSubs.then(
          function (subs) {
            // TODO : check if a list of subscriptions be checked to make the
            //        test more narrow. should also run locally
            assert.isNotEmpty(subs, 'Subscriptions should not be empty');
          }
        );
      }
    );

    after(
      function (done) {
        // save account id and apiToken
        global.saveResource(
          {
            type: 'account',
            id: account.collabId,
            apiToken: account.githubCollabApiToken,
            role: 'collab'
          },
          function () {
            return done();
          }
        );
      }
    );
  }
);
