module.exports = {
  "env": {
    "browser": true
  },
  "plugins": [
    "callback-function"
  ],
  "globals": {
    "__dirname": true,
    "_": true,
    "$": true,
    "ActErr": true,
    "AMQP": true,
    "angular": true,
    "ansi_up": true,
    "app": true,
    "async": true,
    "global": true,
    "jsyaml": true,
    "config": true,
    "d3": true,
    "document": true,
    "httpServer": true,
    "io": true,
    "logger": true,
    "MicroService": true,
    "module": true,
    "moment": true,
    "process": true,
    "require": true,
    "shipError": true,
    "Set": "true",
    "window": true,
    "www": true,
    "util": true,
    "respondWithError": true,
    "sendJSONResponse": true,
    "mapSequelizeErr": true,
    "describe": true,
    "it": true,
    "before": true,
    "msName": true,
    "Promise": true,
    "after": true
  },
  "extends": "airbnb-base/legacy",
  "rules": {
    // rules to override from airbnb/legacy
    "object-curly-spacing": ["error", "never"],
    "curly": ["error", "multi", "consistent"],
    "no-param-reassign": ["error", { "props": false }],
    "no-underscore-dangle": ["error", { "allow": ["_r", "_p"] }],
    "quote-props": ["error", "consistent-as-needed"],

    // rules from airbnb that we won't be using
    "consistent-return": 0,
    "default-case": 0,
    "func-names": 0,
    "no-plusplus": 0,
    "no-use-before-define": 0,
    "vars-on-top": 0,
    "no-loop-func": 0,
    "no-underscore-dangle": 0,
    "no-param-reassign": 0,
    "one-var-declaration-per-line": 0,
    "one-var": 0,


    // extra rules not present in airbnb
    "max-len": ["error", 80],

    // temp turned off. If writing new file these should be turned on.
    "no-shadow": 0,
    "no-mixed-operators": 0,

    // custom rules
    // "callback-function/on-newline": ["error", "auto-fix"]
  }
};
