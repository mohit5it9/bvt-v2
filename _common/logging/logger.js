'use strict';

var self = logger;
module.exports = self;

var winston = require('winston');

function logger(logLevel) {
  var logger = winston;
  logLevel = logLevel || 'warn';

  logger.clear();

  logger.add(winston.transports.Console,
    {
      timestamp: true,
      colorize: true,
      level: logLevel
    }
  );

  return logger;
}
