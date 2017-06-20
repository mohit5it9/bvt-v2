/* eslint no-console:0 */

'use strict';

var self = startTests;
module.exports = self;

// NOTE: this file will be used when more tests are put in place
//  until then tests are run by a shell script. refer package.json

// setup the microservice for api health checks
// fetch system integrations for Auth using service user token
// will run mocha test modules
//    https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically

var setupTests = require('./_common/setupTests.js');
var spawn = require('child_process').spawn;
var scriptName = 'testRunner|';

startTests();
function startTests() {
  var who = scriptName + startTests.name;
  logger.info(who, 'Inside');
  setupTests().then(
    function () {
      var bag = {
        who: who
      };

      async.series(
        [
          doCleanup.bind(null, bag),
          runTests.bind(null, bag)
        ],
        function (err) {
          if (err) {
            logger.error('tests finished with errors');
            process.exit(1);  // make the script fail on errors
          }
        }
      );
    },
    function (err) {
      logger.error(who, 'Failed to setup tests with error: %s', err);
      process.exit(1);
    }
  );
}


function runTests(bag, next) {
  var who = bag.who + '|' + runTests.name;
  logger.debug(who, 'Inside');

  // takes a list of files/ directories for mocha and runs all in series
  var tests = [
    'tests/core_login/*.js',
    'tests/core/*.js'
  ];
  async.eachSeries(tests,
    function (test, nextTest) {
      var _who = who + '|' + test;
      logger.debug(_who, 'Inside');
      var child = spawn('node_modules/mocha/bin/mocha', [test]);
      child.stdout.on('data',
        function (data) {
          var str = '' + data; // converts output to string
          str = str.replace(/\s+$/g, ''); // replace trailing newline & space
          console.log(str);
        }
      );
      child.stderr.on('data',
        function (data) {
          var str = '' + data;
          str = str.replace(/\s+$/g, '');
          console.log(str);
        }
      );
      child.on('close',
        function (code) {
          if (code > 0) {
            logger.error(_who, util.format('%s test suites failed', code));
            return nextTest('some tests failed');
          }

          return nextTest();
        }
      );
    },
    function (err) {
      if (err) {
        logger.warn(who, 'tests failed');
        return next(err);
      }
      logger.info(who, 'all tests done');
      return next();
    }
  );
}

function doCleanup(bag, next) {
  var who = bag.who + '|' + doCleanup.name;
  logger.debug(who, 'Inside');

  var child = spawn('node', ['doCleanup.js'], {stdio: 'inherit'});
  child.on('close',
    function (code, err) {
      if (code > 0) {
        logger.error(who, util.format('test cleanup failed with err %s', err));
        return next(true);
      }
      return next();
    }
  );
}

