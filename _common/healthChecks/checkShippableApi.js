'use strict';

var self = checkShippableApi;
module.exports = self;

var Adapter = require('../shippable/Adapter.js');

function checkShippableApi(params, callback) {
  var bag = {
    params: params
  };
  bag.who = util.format('_common|_healthCheck|%s|msName:%s', self.name, msName);
  logger.verbose('Checking health of ', bag.who);

  async.series(
    [
      _checkInputParams.bind(null, bag),
      _testApi.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed health checks');
      else
        logger.verbose(bag.who, 'Successful health checks');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];
  bag.adapter = new Adapter('');

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        logger.error(bag.who, e);
      }
    );
    return next(true);
  } return next();
}

function _testApi(bag, next) {
  var who = bag.who + '|' + _testApi.name;
  logger.debug(who, 'Inside');

  bag.adapter.get('',
    function (err, res) {
      if (err || !res) {
        logger.error(
          util.format('%s has failed api check :no response or error %s',
            who, err)
        );
        return next(true);
      }

      if (res && res.status !== 'OK') {
        logger.error(
          util.format('%s has failed api check :bad response', who)
        );
        return next(true);
      }
      return next();
    }
  );
}
