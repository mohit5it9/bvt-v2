'use strict';

var self = checkHealth;
module.exports = self;

var Adapter = require('./shippable/Adapter.js');

// checks if API is up
function checkHealth(callback) {
  var who = util.format('%s|msName:%s', self.name, msName);
  logger.verbose('Checking health of', who);

  var adapter = new Adapter('');
  adapter.get('',
    function (err, res) {
      if (err || !res) {
        logger.error(
          util.format('%s has failed api check :no response or error %s',
            who, err)
        );
        return callback(true);
      }

      if (res && res.status !== 'OK') {
        logger.error(
          util.format('%s has failed api check :bad response', who)
        );
        return callback(true);
      }
      return callback();
    }
  );
}
