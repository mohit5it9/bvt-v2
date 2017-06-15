module.exports = {
  // TODO: add a shippable.yml for linting checks
  "env": {
    "browser": false
  },
  "plugins": [
    "callback-function"
  ],
  "globals": {
    "__dirname": true,
    "_": true,
    "async": true,
    "global": true,
    "config": true,
    "logger": true,
    "module": true,
    "process": true,
    "require": true,
    "util": true,
    "describe": true,
    "it": true,
    "before": true,
    "msName": true,
    "Promise": true,
    "after": true,
    "assert": true
  },
  "extends": "airbnb-base/legacy",
  "rules": {
    // rules to override from airbnb/legacy
    "object-curly-spacing": ["error", "never"],
    "curly": ["error", "multi", "consistent"],
    "no-param-reassign": ["error", { "props": false }],
    "no-underscore-dangle": ["error", { "allow": ["_r", "_p"] }],
    "quote-props": ["error", "consistent-as-needed"],
    "no-unused-vars": ["warn"],
    "global-require": ["warn"],
    "no-shadow": ["warn"],

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
    // custom rules
    "callback-function/on-newline": ["error", "auto-fix"]
  }
};
