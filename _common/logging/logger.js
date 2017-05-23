'use strict';

var util = require('util');
var winston = require('winston');
var WinstonFileTransport = winston.transports.File;
var WinstonConsoleTransport = winston.transports.Console;
global.logger = winston;

configLevel();

function configLevel() {
  winston.clear();

  winston.add(WinstonConsoleTransport, {
    timestamp: true,
    colorize: true,
    level: config.logLevel
    level: 'info'
  }
  );

  winston.add(WinstonFileTransport, {
    name: 'file#out',
    timestamp: true,
    colorize: true,
    filename: util.format('logs/%s.log', msName),
    maxsize: 10485760, // maxsize: 10mb
    maxFiles: 20,
    level: global.config.logLevel,
    json: false
  }
  );

  winston.add(WinstonFileTransport, {
    name: 'file#err',
    timestamp: true,
    colorize: true,
    filename: util.format('logs/%s_err.log', msName),
    maxsize: 10485760, // maxsize: 10mb
    maxFiles: 20,
    level: 'error',
    json: false
  }
  );

  winston.add(WinstonFileTransport, {
    name: 'file#warn',
    timestamp: true,
    colorize: true,
    filename: util.format('logs/%s_warn.log', msName),
    maxsize: 5242880, // maxsize: 5mb
    maxFiles: 20,
    level: 'warn',
    json: false
  }
  );

  winston.add(WinstonFileTransport, {
    name: 'file#info',
    timestamp: true,
    colorize: true,
    filename: util.format('logs/%s_info.log', msName),
    maxsize: 5242880, // maxsize: 5mb
    maxFiles: 20,
    level: 'info',
    json: false
  }
  );

  winston.add(WinstonFileTransport, {
    name: 'file#debug',
    timestamp: true,
    colorize: true,
    filename: util.format('logs/%s_debug.log', msName),
    maxsize: 5242880, // maxsize: 5mb
    maxFiles: 20,
    level: 'debug',
    json: false
  }
  );
}
