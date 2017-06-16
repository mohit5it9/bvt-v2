# BVT-2

## Running locally

1. Copy `local.env.template` to `local.env`.
    - Obtain the `SHIPPABLE_API_TOKEN` from your `systemSettings`/`systemConfigs` and populate it.
    - Obtain the `GITHUB_ACCESS_TOKEN_OWNER`, `GITHUB_ACCESS_TOKEN_MEMBER` from Github and populate it.
2. Run `./base`. This will bring up the test container.
3. Run `./local.sh`. This will run the tests in the build container.

## References

* [Taxnomony wiki](https://github.com/Shippable/pm/wiki/test-automation-taxonomy)
