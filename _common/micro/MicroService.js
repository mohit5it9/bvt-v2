'use strict';

var self = MicroService;
module.exports = self;

function MicroService(params, callback) {
  logger.info('Starting', msName);
  this.timeoutLength = 1;
  this.timeoutLimit = 180;
  this.checkHealth = params.checkHealth;
  return this.init(callback);
}

MicroService.prototype.init = function (callback) {
  logger.verbose('Initializing', msName);
  async.series(
    [
      this.checkHealth.bind(this)
    ],
    function (err) {
      if (err) {
        logger.error('Failed to init microservice');
        return this.error(err);
      }
      if (callback)
        return callback();
      logger.debug('no callback for MS');
    }.bind(this)
  );
};

MicroService.prototype.error = function (err) {
  logger.error(err);
  logger.verbose(
    util.format('Since an error occurred, re-connecting %s', msName)
  );
  async.series([],
    function () {
      this.retry();
    }.bind(this)
  );
};

MicroService.prototype.retry = function () {
  this.timeoutLength *= 2;
  if (this.timeoutLength > this.timeoutLimit)
    this.timeoutLength = 1;

  logger.verbose(
    util.format('Waiting for %s seconds before re-connecting %s',
      this.timeoutLength, msName)
  );
  setTimeout(this.init.bind(this), this.timeoutLength * 1000);
};
