'use strict';

var self = start;
module.exports = self;

// Entry point for all the tests
// setup the microservice for api health checks
// fetch system integrations for Auth using service user token
// will run mocha test modules
//    https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically


var checkHealth = require('./_common/checkHealth.js');
var MS = require('./_common/micro/MicroService.js');
var setupTests = require('./_common/setupTests.js');

var Mocha = require('mocha'),
  fs = require('fs'),
  path = require('path');

start();

function start() {
  var msParams = {
    checkHealth: checkHealth
  };

  var params = {
    msName: 'bat'
  };

  var who = util.format('msName:%s', params.msName);

  var consoleErrors = [];
  setupTests(params);

  logger.info(util.format('Starting %s', who));

  if (!config.apiUrl)
    consoleErrors.push(util.format('%s is missing env var: SHIPPABLE_API_URL',
      who));

  if (!config.apiToken)
    consoleErrors.push(util.format('%s is missing env var: API_TOKEN', who));

  if (!global.configPath)
    consoleErrors.push(util.format('%s is missing env var: ' +
      'SHIPPABLE_CONFIG_PATH', who));

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (err) {
        logger.error(who, err);
      }
    );
    return process.exit(1);
  }

  logger.info(util.format('system config checks for %s succeeded', who));


  // do cleanup before starting tests
  doCleanup();
  // start tests after microservice has finished health checks
  var microService = new MS(msParams, function () {
    startCoreTests();
  });
}

function startCoreTests() {
  var bag = {
    who: 'startCoreTests'
  };

  async.series(
    [
      coreAccountLoginTests.bind(null, bag),
      coreTests.bind(null, bag)
      // TODO: cleanup
    ],
    function (err) {
      if (err)
        logger.error('tests finished with errors');
    }
  );
}

function coreAccountLoginTests(bag, next) {
  var who = bag.who + '|' + coreAccountLoginTests.name;
  logger.debug(who, 'Inside');

  // TODO: have a common test runner
  var promise = runTest('./testUtils/testTokenExchange.js');
  promise.then(function () {
    return next();
  }, function (error) {
    return next(error);
  });
}

function coreTests(bag, next) {
  logger.debug('TO IMPLEMENT');
  return next();
}

// runs a single test
function runTest(testSuite) {
  logger.debug(runTest.name, 'Inside');

  var mocha = new Mocha();
  mocha.addFile(testSuite);

  return new Promise(function (resolve, reject) {
    mocha.run(function (failures) {
      process.on('exit', function () {
        process.exit(failures);  // exit with non-zero status for failures
      });
      return reject();
    }).on('end', function () {
      logger.debug('finished running all tests');
      return resolve();
    });
  });
}

// serially runs all the tests in a directory
function runTests(testDir) {
  var mocha = new Mocha();
  // Add each .js file to the mocha instance
  var testSuites = fs.readdirSync(testDir);
  testSuites.forEach(function (testSuite) {
    mocha.addFile(
      path.join(testDir, testSuite)
    );
  });

  // Run the tests.
  return new Promise(function (resolve, reject) {
    // asynchronous code goes here
    mocha.run(function (failures) {
      process.on('exit', function () {
        process.exit(failures);  // exit with non-zero status for failures
      });
      reject();
    }).on('end', function () {
      logger.debug('finished running all tests');
      resolve();
    });
  });
}

function doCleanup() {
  logger.warn('TODO: Implement Cleanup');
}
