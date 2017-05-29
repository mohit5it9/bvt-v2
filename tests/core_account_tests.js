'use strict';

var nconf = require('nconf');
var request = require('request');
var setupTests = require('../_common/setupTests.js');

var tokens = {};
var githubSysIntId = null;

var testSuite = 'ACCT-GHC-ADM-IND';
var testSuiteDesc = '- TestCases for Github Admin for login';
describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(global.TIMEOUT_VALUE);
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

          tokens.githubOwnerApiToken = body.apiToken;
          return done(err);
        });
      }
    );

    after(
      function (done) {
        nconf.set('shiptest-github-owner:apiToken', tokens.ownerApiToken);
        nconf.save(
          function (err) {
            assert.isNotOk(err, 'Failed to save tokens to config file');
            return done();
          }
        );
      }
    );
  }
);
