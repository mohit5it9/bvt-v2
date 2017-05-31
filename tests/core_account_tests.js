'use strict';

var setupTests = require('../_common/setupTests.js');

var account = {};
var githubSysIntId = null;

var testSuite = 'ACCT-GHC-ADM-IND';
var testSuiteDesc = '- TestCases for Github Admin for login';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests();
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

    it('1. Login should generate API token',
      function (done) {
        var json = {
          accessToken: global.githubOwnerAccessToken
        };
        global.pubAdapter.postAuth(githubSysIntId, json,
          function (err, body, res) {
            assert.strictEqual(err, null, 'Error should be null');
            assert.isNotEmpty(res, 'Result should not be empty');
            assert.strictEqual(res.statusCode, 200, 'statusCode should be 200');
            assert.isNotEmpty(body, 'body should not be null');
            assert.isNotNull(body.apiToken, 'API token should not be null');

            account.githubOwnerApiToken = body.apiToken;
            account.ownerId = body.account.id;

            return done(err);
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
            apiToken: account.githubOwnerApiToken
          },
          function () {
            return done();
          }
        );
      }
    );
  }
);
