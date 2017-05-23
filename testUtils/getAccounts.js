'use strict';

var Start = require('testRunner.js');
var nconf = require('nconf');
var chai = require('chai');
var _ = require('underscore');
var async = require('async');
var util = require('util');

var GithubAdapter = require('../_common/shippable/github/Adapter.js');
var ShippableAdapter = require('../_common/shippable/Adapter.js');
var createIssue = require('../_common/')

var testSuiteNum = '0.';
var testSuiteDesc = 'Setup empty testAccounts objects';

var assert = chai.assert;

describe(util.format('%s1 - %s', testSuiteNum, testSuiteDesc),
  function () {
    var pathToJson = './tests/config.json';
    nconf.argv().env().file({
      file: pathToJson, format: nconf.formats.json
    }
    );
    nconf.load();
    var tokens = {
      owner: {
        id: '',
        apiToken: nconf.get('shiptest-github-owner:apiToken')
      },
      member: {
        id: '',
        apiToken: nconf.get('shiptest-github-member:apiToken')
      }
    };
    console.log(tokens);

    before(function (done) {
      // runs before all tests in this block
      // TODO: analyse Start and remove this block if not needed.
      new Start(nconf.get('shiptest-github-owner:apiToken'),
                nconf.get('GITHUB_ACCESS_TOKEN_OWNER'));
      return done();
    });

    it('Get /accounts',
      function (done) {
        this.timeout(0);

        console.log('config.apiToken is::', global.config.apiToken);
        async.each(tokens,
          function (token, nextToken) {
            var shippable = new ShippableAdapter(token.apiToken);
            shippable.getAccounts('',
              function (err, res) {
                if (err) {
                  var bag = {
                    testSuite: 'Get /accounts',
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
                      return nextToken();
                    }
                  );
                } else {
                  logger.debug('res is::', util.inspect(res, {depth: null}));
                  if (res.status < 200 || res.status >= 299)
                    logger.warn('status is::', res.status);

                  if (_.isEmpty(res)) {
                    logger.warn('getAccounts returned no account which is ' +
                      'not expected, hence skipping subsequent test cases');
                    assert.notEqual(res.length, 0);
                  } else                    { token.id = _.first(res).id; }
                  return nextToken();
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

    it('Should save accountIds to config file',
      function (done) {
        nconf.set('shiptest-github-owner:accountId', tokens.owner.id);
        nconf.set('shiptest-github-member:accountId', tokens.member.id);
        nconf.save(function (err) {
          if (err)
            console.log('Failed');
          return done();
        });
      }
    );
  }
);
