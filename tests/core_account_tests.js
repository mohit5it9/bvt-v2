'use strict';

var nconf = require('nconf');
var request = require('request');
var setupTests = require('../_common/setupTests.js');
var ShippableAdapter = require('../_common/shippable/Adapter.js');

var tokens = {};
var githubSysIntId = null;

var testSuite = 'ACCT-GHC-ADM-IND';
var testSuiteDesc = '- TestCases for Github Admin for login';
describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests();
        var promise = getGithubSystemIntegrationId();
        promise.then(
          function (sysIntId) {
            assert.isOk(sysIntId, 'Github sysIntId should be present');
            githubSysIntId = sysIntId;
            return done();
          },
          function () {
            return done(true);
          }
        );
      }
    );

    it('1. Login should generate API token',
      function (done) {
        var promise = loginUsingToken(global.githubOwnerAccessToken,
          githubSysIntId);
        promise.then(
          function (apiToken) {
            assert.isOk(apiToken, 'API token should not be null');
            tokens.ownerApiToken = apiToken;
            return done();
          },
          function (error) {
            return done(error);
          });
      }
    );

    after(
      function (done) {
        nconf.set('shiptest-github-owner:apiToken', tokens.ownerApiToken);
        nconf.save(
          function (err) {
            if (err) {
              logger.err('Failed to save tokens to config file');
              return done(err);
            }
            return done();
          }
        );
      }
    );
  }
);

function getGithubSystemIntegrationId() {
  logger.debug(getGithubSystemIntegrationId.name, 'Inside');
  var suAdapter = new ShippableAdapter(global.config.apiToken);
  var query = 'masterName=githubKeys&name=auth';
  var promise = new Promise(
    function (resolve, reject) {
      suAdapter.getSystemIntegrations(query,
        function (err, systemIntegrations) {
          if (err) {
            logger.error('Failed to getSystemIntegrations with error: ' +
              err.message);
            return reject();
          }

          var systemIntegration = _.first(systemIntegrations);

          if (!systemIntegration) {
            logger.error('No systemIntegration found for github');
            return reject();
          }
          return resolve(systemIntegration.id);
        }
      );
    }
  );
  return promise;
}

// TODO: usecreate github adapter.
// test login based on token and scm name can be reused for any provider
function loginUsingToken(token, scmSystemIntegrationId) {
  if (!scmSystemIntegrationId) {
    logger.error('failed to get system integration for scm: ',
      scmSystemIntegrationId);
    return;
  }

  var promise = new Promise(
    function (resolve, reject) {
      request({
        url: global.config.apiUrl + '/accounts/auth/' + scmSystemIntegrationId,
        method: 'POST',
        json: {
          accessToken: token
        }
      }, function (err, res, body) {
        if (err) {
          logger.error('Failed login for SCM, err: ', err);
          return reject();
        }

        return resolve(body.apiToken);
      });
    }
  );
  return promise;
}
