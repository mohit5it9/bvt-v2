#!/bin/bash

export RES_GH_SSH="bvt_v2_ghc_owner_ssh_key"

export RES_GH_SSH_UP=$(echo $RES_GH_SSH | awk '{print toupper($0)}')
export RES_GH_SSH_META=$(eval echo "$"$RES_GH_SSH_UP"_META")

if [ -z $TAG_NAME ]; then
  export TAG_NAME=$(date "+date%y/%m/%d/time%H/%M/%S")
fi

add_ssh_key() {
 pushd "$RES_GH_SSH_META"
 echo "Extracting ssh key"
 echo "-----------------------------------"
 cat "integration.json"  | jq -r '.privateKey' > gh_ssh.key
 chmod 600 gh_ssh.key
 ssh-add gh_ssh.key 2>&1
 echo "Completed Extracting SSH key complete"
 echo "-----------------------------------"
 popd
}

echo "############ setup git config ###############"
git config --global user.email "shiptestowner@gmail.com" 2>&1
git config --global user.name "shiptest-github-owner" 2>&1

add_ssh_key

echo "######### cloning repo #########"
git clone git@github.com:shiptest-github-organization-1/shiptest_org_private_project_1 2>&1
cd shiptest_org_private_project_1

echo "############ create tag ############"
git tag $TAG_NAME 2>&1

echo "########### pushing to git ##########"
git push origin --tags 2>&1

rm -rf shiptest_org_private_project_1
