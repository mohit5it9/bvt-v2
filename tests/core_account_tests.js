'use strict';

var nconf = require('nconf');
var request = require('request');
var util = require('util');
var setupTests = require('../_common/setupTests.js');
var ShippableAdapter = require('../_common/shippable/Adapter.js');

var tokens = {};
var githubSysIntId = null;

describe('ACCT-GHC-ADM-IND.1 - Get shippable token for github login',
  function () {
    this.timeout(0);
    before(
      function (done) {
        setupTests('ACCT-GHC-IND');
        getGithubSystemIntegration(done);
      }
    );

    it('Test github login',
      function (done) {
        logger.debug('authenticating... ');
        var promise = loginUsingToken(global.githubOwnerAccessToken,
          githubSysIntId);
        promise.then(
          function () {
            return done();
          },
          function (error) {
            return done(error);
          });
      }
    );
    // remaining tests go here

    after(
      function (done) {
        logger.debug('Should save tokens in config file');
        nconf.set('shiptest-github-owner:apiToken', tokens.ownerApiToken);
        nconf.save(
          function (err) {
            if (err) {
              logger.debug('Failed to save tokens to config file');
              return done(err);
            }
            return done();
          }
        );
      }
    );
  }
);

function getGithubSystemIntegration(done) {
  logger.debug(getGithubSystemIntegration.name, 'Inside');
  var suAdapter = new ShippableAdapter(global.config.apiToken);
  var query = 'masterName=githubKeys&name=auth';
  suAdapter.getSystemIntegrations(query,
    function (err, systemIntegrations) {
      if (err) {
        logger.error('Failed to getSystemIntegrations with error: ' +
          err.message);
        return done(true);
      }

      var systemIntegration = _.first(systemIntegrations);

      if (!systemIntegration) {
        logger.error('No systemIntegration found for github');
        return done(true);
      }

      githubSysIntId = systemIntegration.id;
      return done();
    }
  );
}

// test login based on token and scm name
// can be reused for any provider
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
          return reject(true);
        }

        if (!body.apiToken) {
          logger.error('Error no apiToken in response', util.inspect(body));
          return reject(true);
        }
        tokens.ownerApiToken = body.apiToken;
        return resolve();
      });
    }
  );
  return promise;
}
