
'use strict';

var setupTests = require('../../_common/setupTests.js');

var testSuite = 'ACCT-GHC-COL-ORG';
var testSuiteDesc = ' - TestSuite for Github Org admin permissions';

describe(testSuite + testSuiteDesc,
  function () {
    var subscriptions = null;
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            global.setupGithubAdminAdapter();
            global.ghcAdminAdapter.getSubscriptions('',
              function (err, response) {
                if (err)
                  return done(new Error(
                    util.format('Unable to get subs with error %s, %s',
                    err, response)));
                subscriptions = response;
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

    it('1. Organisation admin is admin for the subscription',
      function (done) {
        var currentSub =
          _.findWhere(subscriptions, {orgName: global.GITHUB_ORG_NAME});
        assert.isNotEmpty(currentSub,
          'Current subscription should not be empty');

        var query = util.format('subscriptionIds=%s', currentSub.id);

        global.ghcAdminAdapter.getSubscriptionAccounts(query,
          function (err, subAccounts) {
            assert(!err, util.format('Unable to get subAccounts with error %s',
              err));
            assert.isNotEmpty(subAccounts,
              'SubscriptionAccounts should not be empty');

            var collabSystemCode = _.findWhere(global.systemCodes,
              {name: 'collaborator', group: 'roles'}).code;
            var adminSystemCode = _.findWhere(global.systemCodes,
              {name: 'admin', group: 'roles'}).code;

            assert.isNotEmpty(_.where(subAccounts,
              {roleCode: collabSystemCode}), 'Admin of an org is missing ' +
              'collaborator role');
            assert.isNotEmpty(_.where(subAccounts,
              {roleCode: adminSystemCode}), 'Admin of an org is not' +
              'having admin role');

            return done();
          }
        );
      }
    );

    // nothing to clean up in this case
    after(
      function (done) {
        return done();
      }
    );
  }
);
