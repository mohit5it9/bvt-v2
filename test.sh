#!/bin/bash -e

exec_container_cmd() {
  docker exec $ONEBOX_NAME bash -c "cd $COMPONENT_DIR && source local.env && $@"
}

setup_envs() {
  export RES_REPO="bvt_v2_repo"
  export RES_PARAMS=$1
  export RES_REPO_UP=$(echo $RES_REPO | awk '{print toupper($0)}')
  export RES_REPO_STATE=$(eval echo "$"$RES_REPO_UP"_STATE")
  export RES_PARAMS_UP=$(echo $RES_PARAMS | awk '{print toupper($0)}')
  export RES_PARAMS_META=$(eval echo "$"$RES_PARAMS_UP"_META")
  pushd $RES_PARAMS_META
  export $(jq -r '.version.propertyBag.params.secure' version.json)
  popd
}

setup_envs_local() {
  readonly COMPONENT="bvt"
  readonly ONEBOX_NAME="$COMPONENT"_onebox
  readonly COMPONENT_DIR="/home/shippable/$COMPONENT"
}

core_tests() {
  pushd $RES_REPO_STATE
  npm install
  npm run test-coreAccountLogin
  popd
}

core_tests_local() {
  exec_container_cmd "npm run test-coreAccountLogin"
}

main() {
  if [ "$1" != "local" ];
  then
    setup_envs
    core_tests
  else
    setup_envs_local
    core_tests_local
  fi
}

main $@
