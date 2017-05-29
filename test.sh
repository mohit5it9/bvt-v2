#!/bin/bash -e

export RES_REPO="bvt_v2_repo"
export RES_PARAMS=$1

export RES_REPO_UP=$(echo $RES_REPO | awk '{print toupper($0)}')
export RES_REPO_STATE=$(eval echo "$"$RES_REPO_UP"_STATE")

export RES_PARAMS_UP=$(echo $RES_PARAMS | awk '{print toupper($0)}')
export RES_PARAMS_META=$(eval echo "$"$RES_PARAMS_UP"_META")

setupTestEnv() {
  echo "Starting Testing Env setup" $RES_REPO

  pushd $RES_PARAMS_META
  export $(jq -r '.version.propertyBag.params.secure' version.json)
  popd

  pushd $RES_REPO_STATE
  npm install
  npm run test-coreAccountLogin
  popd

  echo "Completed Testing Env setup" $RES_REPO

}

setupTestEnv