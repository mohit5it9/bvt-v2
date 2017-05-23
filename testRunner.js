'use strict';

var self = start;
module.exports = self;

// Entry point for all the tests
// setup the microservice for api health checks
// fetch system integrations for Auth using service user token
// will run mocha test modules
//    https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically

var Adapter = require('./shippable/Adapter.js');
var setupTests = require('./_common/setupTests.js');

var Mocha = require('mocha'),
  fs = require('fs'),
  path = require('path');

function start() {
  var params = {
    msName: 'bat'
  };

  var who = util.format('msName:%s', params.msName);
  logger.info(util.format('Starting %s', who));

  setupTests(params);

  var consoleErrors = [];
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

  doCleanup();
  startCoreTests();
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

  var promise = runTest('./tests/core_account_tests.js');
  promise.then(
    function () {
      return next();
    },
    function (error) {
      return next(error);
    }
  );
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
    mocha.run(
      function (failures) {
        process.on('exit',
          function () {
            process.exit(failures);  // exit with non-zero status for failures
          }
        );
        return reject();
      }
    ).on('end',
      function () {
        logger.debug('finished running all tests');
        return resolve();
      }
      );
  });
}

// serially runs all the tests in a directory
function runTests(testDir) {
  var mocha = new Mocha();
  // Add each .js file to the mocha instance
  var testSuites = fs.readdirSync(testDir);
  testSuites.forEach(
    function (testSuite) {
      mocha.addFile(
        path.join(testDir, testSuite)
      );
    }
  );

  // Run the tests.
  return new Promise(function (resolve, reject) {
    // asynchronous code goes here
    mocha.run(
      function (failures) {
        process.on('exit',
          function () {
            process.exit(failures);  // exit with non-zero status for failures
          }
        );
        reject();
      }
    ).on('end',
      function () {
        logger.debug('finished running all tests');
        resolve();
      }
      );
  });
}

function doCleanup() {
  logger.warn('TODO: Implement Cleanup');
}

// starts by checking if API is up
function checkHealth() {
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
        process.exit(1);
      }

      if (res && res.statusCode !== 200) {
        logger.error(
          util.format('%s has failed api check :bad response', who)
        );
        process.exit(1);
      }
      start();
    }
  );
}

checkHealth();
