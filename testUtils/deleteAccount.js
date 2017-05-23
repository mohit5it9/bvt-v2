'use strict';

var start = require('testRunner.js');
var mocha = require('mocha');
var nconf = require('nconf');
var chai = require('chai');
var testSuiteNum = '5.';
var testSuiteDesc = 'Delete account';
var adapter = require('../_common/shippable/github/Adapter.js');
var Shippable = require('../_common/shippable/Adapter.js');

var assert = chai.assert;

describe(util.format('%s1 - %s', testSuiteNum, testSuiteDesc),
  function () {
    before(function (done) {
      // runs before all tests in this block
      var pathToJson = './tests/config.json';
      nconf.argv().env().file({
        file: pathToJson, format: nconf.formats.json
      }
      );
      nconf.load();
      start = new start(nconf.get('shiptest-github-owner:apiToken'),
                nconf.get('GITHUB_ACCESS_TOKEN_OWNER'));
      return done();
    });

    it('Should delete account',
      function (done) {
        this.timeout(0);

        var accountIds = {
          owner: {
            id: nconf.get('shiptest-github-owner:accountId'),
            apiToken: nconf.get('shiptest-github-owner:apiToken')
          },
          member: {
            id: nconf.get('shiptest-github-member:accountId'),
            apiToken: nconf.get('shiptest-github-member:apiToken')
          }
        };
        async.each(accountIds,
          function (accountObj, nextObj) {
            if (!accountObj.id) return nextObj();
            if (!accountObj.apiToken) return nextObj();

            var shippable = new ShippableAdapter(accountObj.apiToken);
            shippable.deleteAccountById(accountObj.id,
              function (err, res) {
                if (err && err.status !== 404) {
                  var bag = {
                    testSuite: util.format('%s1 - delete Account with id: %s',
                                 testSuiteNum, accountObj.id),
                    error: err
                  };
                  async.series([
                    _createIssue.bind(null, bag)
                  ],
                    function (err) {
                      if (err)
                        logger.warn('Failed');
                      else
                        logger.debug('Issue Created');

                      assert.equal(err, null);
                      return nextObj();
                    }
                  );
                } else {
                  logger.debug('res is::', util.inspect(res, {depth: null}));
                  if (res.status < 200 || res.status >= 299)
                    logger.warn('status is::', res.status);
                  return nextObj();
                }
              }
            );
          },
          function (err) {
            if (err)
              console.log('Failed');
            return done();
          }
        );
      }
    );
  }
);

function _createIssue(bag, next) {
  var githubAdapter = new adapter(config.githubToken, config.githubUrl);
  var title = util.format('Failed test case %s', bag.testSuite);
  var body = util.format('Failed with error: %s', bag.error);
  var data = {
    title: title,
    body: body
  };
  githubAdapter.pushRespositoryIssue('deepikasl', 'VT1', data,
    function (err, res) {
      logger.debug('response is::', res.status);
      if (err)
        logger.warn('Creating Issue failed with error: ', err);
      return next();
    }
  );
}
