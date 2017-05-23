# Work in Progress

Brief Description of new BVT-V2

Fixes problems with older BVT especially cleanup and reliability. 

Each testSuite is in a separate js file and is designed to be independent of 
remaining tests

To run locally, set environment variables

1.
```
export SHIPPABLE_API_URL=http://localhost:50000
export SHIPPABLE_CONFIG_PATH=./tests/config.json
export SHIPPABLE_API_TOKEN=<shippable_service_user_token>
export GITHUB_ACCESS_TOKEN_OWNER=<github_access_token>
```

2. Run `node testRunner.js` or `npm test`