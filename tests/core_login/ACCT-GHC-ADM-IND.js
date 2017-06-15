'use strict';

var setupTests = require('../../_common/setupTests.js');

var account = {};
var githubSysIntId = null;
var backoff = require('backoff');

var testSuite = 'ACCT-GHC-ADM-IND';
var testSuiteDesc = '- TestCases for Github Admin for login';

describe(testSuite + testSuiteDesc,
  function () {
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
                assert.isOk(gitSysInt, 'No system integration found for github');
                assert.isOk(gitSysInt.id, 'Github sysIntId should be present');
                githubSysIntId = gitSysInt.id;
                return done();
              }
            );
          }
        );
      },
      function (err) {
        logger.error(testSuite, 'failed to setup tests. err:', err);
        return done(err);
      }
    );

    it('1. Login should generate API token',
      function (done) {
        var json = {
          accessToken: global.githubOwnerAccessToken
        };
        global.pubAdapter.postAuth(githubSysIntId, json,
          function (err, body, res) {
            assert.isNotEmpty(res, 'Result should not be empty');
            assert.strictEqual(res.statusCode, 200, 'statusCode should be 200');
            assert.isNotEmpty(body, 'body should not be null');
            assert.isNotNull(body.apiToken, 'API token should not be null');

            account.githubOwnerApiToken = body.apiToken;
            account.ownerId = body.account.id;
            global.setupGithubAdminAdapter(body.apiToken);

            return done(err);
          }
        );
      }
    );

    it('2. Login account should finish syncing',
      function () {
        var accountSynced = new Promise(
          function (resolve, reject) {
            var query = util.format('accountIds=%s', account.ownerId);

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
                global.suAdapter.getAccounts(query,
                  function (err, accounts) {
                    if (err)
                      return reject(new Error('Failed to get account with err',
                        err));

                    var account = _.first(accounts);
                    if (account.isSyncing !== false || !account.lastSyncStartDate) {
                      expBackoff.backoff();
                    } else {
                      expBackoff.reset();
                      return resolve(account);
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
          function (account) {
            assert.isNotEmpty(account, 'account should not be empty');
          }
        );
      }
    );

    it('3. Login - should sync projects',
      function () {
        var getProjects = new Promise(
          function (resolve, reject) {
            global.ghcAdminAdapter.getProjects('',
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
            global.ghcAdminAdapter.getSubscriptions('',
              function (err, subs) {
                if (err)
                  return reject(new Error('Unable to get subs with error',
                    err));
                return resolve(subs);
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
            id: account.ownerId,
            apiToken: account.githubOwnerApiToken,
            role: 'admin'
          },
          function () {
            return done();
          }
        );
      }
    );
  }
);
