
'use strict';

var setupTests = require('../../_common/setupTests.js');

var testSuite = 'ACCT-GHC-COL-ORG';
var testSuiteDesc = ' - TestSuite for Github Org collab permissions';

describe(testSuite + testSuiteDesc,
  function () {
    this.timeout(0);

    before(
      function (done) {
        setupTests().then(
          function () {
            done();
          },
          function (err) {
            logger.error(testSuite, 'failed to setup tests. err:', err);
            return done(err);
          }
        );
      }
    );

    it('1. Organisation member is collaborator for the subscription',
      function (done) {
        // TODO: global.suAdapter;
        return done();
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
