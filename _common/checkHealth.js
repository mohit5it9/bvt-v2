'use strict';

var self = checkHealth;
module.exports = self;

var checkShippableApi = require('./healthChecks/checkShippableApi.js');

function checkHealth(callback) {
  var bag = {};
  bag.who = util.format('%s|msName:%s', self.name, msName);
  logger.verbose('Checking health of', bag.who);

  async.series([
    checkShippableApi.bind(null, null)
  ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed health checks', err);
      else
        logger.verbose(bag.who, 'Successful health checks');

      return callback(err);
    }
  );
}
