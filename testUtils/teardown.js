'use strict';

var nconf = require('nconf');

var Shippable = require('../_common/shippable/Adapter.js');
var util = require('util');
var async = require('async');

// var util = require

// runs before all tests in this block
var pathToJson = './tests/config.json';
nconf.argv().env().file(
  {
    file: pathToJson, format: nconf.formats.json
  }
);
nconf.load();
// TODO: should get params for which user accounts it needs to delete.
// var start = new Start(nconf.get('shiptest-github-owner:apiToken'),
//           nconf.get('GITHUB_ACCESS_TOKEN_OWNER'));

deleteAccount();

function deleteAccount() {
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
            logger.error('account not found: ', err);
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
        logger.error('Failed');
    }
  );
}
