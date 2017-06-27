'use strict';

var self = Adapter;
module.exports = self;

var async = require('async');
var request = require('request');

var querystring = require('querystring');
var parseLinks = require('parse-links');

function Adapter(token, url) {
  this.token = token;
  if (url) {
    this.baseUrl = url;
  } else {
    logger.warn('Inside common|github|Adapter: Using default url');
    this.baseUrl = config.githubApiUrl;
  }
}

Adapter.prototype.get = function (relativeUrl, callback) {
  var opts = {
    method: 'GET',
    url: relativeUrl.indexOf('http') === 0 ? relativeUrl : this.baseUrl +
    relativeUrl,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'token ' + this.token,
      'User-Agent': 'Shippable API',
      'Accept': 'application/vnd.GithubProvider.v3'
    }
  };

  var bag = {
    opts: opts,
    relativeUrl: relativeUrl,
    token: this.token
  };

  bag.who = util.format('common|github|%s|GET|url:%s', self.name, relativeUrl);
  logger.debug('Starting', bag.who);

  async.series([
    _performCall.bind(null, bag),
    _parseResponse.bind(null, bag)
  ], function () {
    logger.debug('Completed', bag.who);
    callback(bag.err, bag.parsedBody, bag.headerLinks, bag.res);
  });
};

Adapter.prototype.post = function (relativeUrl, json, callback) {
  var opts = {
    method: 'POST',
    url: this.baseUrl + relativeUrl,
    followAllRedirects: true,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'token ' + this.token,
      'User-Agent': 'Shippable v3',
      'Accept': 'application/vnd.GithubProvider.v3'
    },
    json: json
  };
  var bag = {
    opts: opts,
    relativeUrl: relativeUrl,
    token: this.token
  };

  bag.who = util.format('common|github|%s|POST|url:%s', self.name,
    relativeUrl);
  logger.debug('Starting', bag.who);

  async.series([
    _performCall.bind(null, bag),
    _parseResponse.bind(null, bag)
  ], function () {
    logger.debug('Completed', bag.who);
    callback(bag.err, bag.parsedBody, bag.headerLinks, bag.res);
  });
};

Adapter.prototype.put = function (relativeUrl, json, callback) {
  var opts = {
    method: 'PUT',
    url: this.baseUrl + relativeUrl,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'token ' + this.token,
      'User-Agent': 'Shippable v3',
      'Accept': 'application/vnd.GithubProvider.v3'
    },
    json: json
  };
  var bag = {
    opts: opts,
    relativeUrl: relativeUrl,
    token: this.token
  };

  bag.who = util.format('common|github|%s|PUT|url:%s', self.name, relativeUrl);
  logger.debug('Starting', bag.who);

  async.series([
    _performCall.bind(null, bag),
    _parseResponse.bind(null, bag)
  ], function () {
    logger.debug('Completed', bag.who);
    callback(bag.err, bag.parsedBody, bag.headerLinks, bag.res);
  });
};

Adapter.prototype.patch = function (relativeUrl, json, callback) {
  var opts = {
    method: 'PATCH',
    url: this.baseUrl + relativeUrl,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'token ' + this.token,
      'User-Agent': 'Shippable v3',
      'Accept': 'application/vnd.GithubProvider.v3'
    },
    json: json
  };
  var bag = {
    opts: opts,
    relativeUrl: relativeUrl,
    token: this.token
  };

  bag.who = util.format('common|github|%s|PATCH|url:%s', self.name,
    relativeUrl);
  logger.debug('Starting', bag.who);

  async.series([
    _performCall.bind(null, bag),
    _parseResponse.bind(null, bag)
  ], function () {
    logger.debug('Completed', bag.who);
    callback(bag.err, bag.parsedBody, bag.headerLinks, bag.res);
  });
};

Adapter.prototype.del = function (relativeUrl, callback) {
  var opts = {
    method: 'DELETE',
    url: this.baseUrl + relativeUrl,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'token ' + this.token,
      'User-Agent': 'Shippable v3',
      'Accept': 'application/vnd.GithubProvider.v3'
    }
  };

  var bag = {
    opts: opts,
    relativeUrl: relativeUrl,
    token: this.token
  };

  bag.who = util.format('common|github|%s|DELETE|url:%s', self.name,
    relativeUrl);
  logger.debug('Starting', bag.who);

  async.series([
    _performCall.bind(null, bag),
    _parseResponse.bind(null, bag)
  ], function () {
    logger.debug('Completed', bag.who);
    callback(bag.err, bag.parsedBody, bag.res);
  });
};

// common helper methods
function _performCall(bag, next) {
  var who = bag.who + '|' + _performCall.name;
  logger.debug('Inside', who);

  bag.startedAt = Date.now();
  request(bag.opts, function (err, res, body) {
    var interval = Date.now() - bag.startedAt;
    logger.debug('Shippable request ' + bag.opts.method + ' ' +
      bag.opts.url + ' took ' + interval +
      ' ms and returned HTTP status ' + (res && res.statusCode));

    bag.res = res;
    bag.body = body;
    if (res && res.statusCode > 299) err = err || res.statusCode;
    if (err) {
      logger.debug('Github returned status', err,
        'for request', bag.who);
      bag.err = err;
    }
    next();
  });
}

function _parseResponse(bag, next) {
  var who = bag.who + '|' + _parseResponse.name;
  logger.debug('Inside', who);

  if (bag.res && bag.res.headers.link)
    bag.headerLinks = parseLinks(bag.res.headers.link);


  if (bag.body)
    if (typeof bag.body === 'object') {
      bag.parsedBody = bag.body;
    } else {
      try {
        bag.parsedBody = JSON.parse(bag.body);
      } catch (e) {
        logger.debug('Unable to parse bag.body', bag.body, e);
        bag.err = e;
      }
    }

  next();
}

Adapter.prototype.getRateLimit = function (callback) {
  this.get('/rate_limit', callback);
};

Adapter.prototype.getCurrentUser = function (callback) {
  this.get('/user', callback);
};

Adapter.prototype.getUser = function (user, callback) {
  var url = '/users/' + user;
  this.get(url, callback);
};

Adapter.prototype.getUserEmails = function (callback) {
  this.get('/user/emails', callback);
};

Adapter.prototype.getUserOrganizations = function (callback) {
  this.get('/user/orgs', callback);
};

Adapter.prototype.getOrganizationsFor = function (user, callback) {
  var url = '/users/' + user + '/orgs';
  this.get(url, callback);
};

Adapter.prototype.getOrganization = function (org, callback) {
  var url = '/orgs/' + org;
  this.get(url, callback);
};

Adapter.prototype.getOrganizationTeams = function (org, callback) {
  var url = '/orgs/' + org + '/teams';
  this.get(url, callback);
};

Adapter.prototype.getOrganizationMembership =
  function (org, username, callback) {
    var url = '/orgs/' + org + '/memberships/' + username;
    this.get(url, callback);
  };

Adapter.prototype.getOrganizationOwners = function (org, callback) {
  var url = '/orgs/' + org + '/members?role=admin';
  this.get(url, callback);
};

Adapter.prototype.getOrganizationMembers = function (org, callback) {
  var allMembers = [];
  var self = this;
  var url = '/orgs/' + org + '/members';
  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, members, links) {
    allMembers = allMembers.concat(members);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allMembers);
  }
};

Adapter.prototype.getTeam = function (teamId, callback) {
  var url = '/teams/' + teamId;
  this.get(url, callback);
};

Adapter.prototype.checkTeamMember = function (teamId, user, callback) {
  var url = '/teams/' + teamId + '/members/' + user;
  this.get(url, callback);
};

Adapter.prototype.getTeamMembers = function (teamId, callback) {
  var url = '/teams/' + teamId + '/members';
  this.get(url, callback, true);
};

Adapter.prototype.getUserTeams = function (callback) {
  this.get('/user/teams', callback, true);
};

Adapter.prototype.getUserRepositories = function (user, callback) {
  var allRepos = [];
  var self = this;
  var url = '/users/' + user + '/repos?per_page=100';

  this.get(url, _onResponse, true);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allRepos = allRepos.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allRepos);
  }
};

Adapter.prototype.getRepositories = function (callback) {
  var allRepos = [];
  var self = this;
  var url = '/user/repos?type=owner';

  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allRepos = allRepos.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allRepos);
  }
};

Adapter.prototype.getAllRepositories = function (callback) {
  var allRepos = [];
  var self = this;
  var url = '/user/repos?per_page=100';

  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allRepos = allRepos.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allRepos);
  }
};

Adapter.prototype.getAllRepositoriesForUser = function (callback) {
  var allRepos = [];
  var self = this;
  var url = '/user/repos?per_page=100';

  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allRepos = allRepos.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allRepos);
  }
};

Adapter.prototype.getOrgRepositories = function (org, callback) {
  var allRepos = [];
  var self = this;
  var url = '/orgs/' + org + '/repos';

  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allRepos = allRepos.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allRepos);
  }
};

Adapter.prototype.getRepository = function (fullRepoName, callback) {
  this.get('/repos/' + fullRepoName, callback);
};

Adapter.prototype.getRepositoryTeams = function (fullRepoName, callback) {
  this.get('/repos/' + fullRepoName + '/teams', callback);
};

Adapter.prototype.getRepositoryBranches =
  function (fullRepoName, callback) {
    var allRepos = [];
    var self = this;
    var url = '/repos/' + fullRepoName + '/branches';

    this.get(url, _onResponse);

    // this is to handle pagination of github
    function _onResponse(err, repos, links) {
      allRepos = allRepos.concat(repos);
      if (links && links.next)
        self.get(links.next, _onResponse);
      else
        callback(err, allRepos);
    }
  };

Adapter.prototype.getRepositoryCollaborators =
  function (fullRepoName, callback) {
    var allCollaborators = [];
    var self = this;
    var url = '/repos/' + fullRepoName + '/collaborators';

    this.get(url, _onResponse);

    // this is to handle pagination of github
    function _onResponse(err, repos, links) {
      allCollaborators = allCollaborators.concat(repos);
      if (links && links.next)
        self.get(links.next, _onResponse);
      else
        callback(err, allCollaborators);
    }
  };

Adapter.prototype.getIssues = function (query, callback) {
  // All issues the user may view (and scope will allow).
  /* Query object options:
   *  filter: 'assigned', 'created', 'mentioned', 'subscribed', 'all'
   *    Default: 'assigned'
   *    Filter is relative to the authenicated user, e.g. 'assigned' to user.
   *  state: 'open', 'closed', or 'all' Default: 'open'
   *  assignee: username, 'none', or '*' Default: '*'
   *  labels: comma-separated label names
   *  sort: 'created', 'updated', or 'comments' Default: 'created'
   *  direction (of sort): 'asc' or 'desc' Default: 'desc'
   *  since: updated since ISO 8601 format timestamp: YYYY-MM-DDTHH:MM:SSZ
   */
  var url = '/issues?' + querystring.stringify(query);
  this.get(url, callback);
};

Adapter.prototype.getUserIssues = function (query, callback) {
  // Issues from owned and member repositories
  /* See Adapter.prototype.getVisibleIssues for query */
  var allIssues = [];
  var self = this;
  var url = '/user/issues?' + querystring.stringify(query);
  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, issues, links) {
    allIssues = allIssues.concat(issues);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allIssues);
  }
};

Adapter.prototype.getOrganizationIssues =
  function (org, query, callback) {
    // Issues for an organization
    /* See Adapter.prototype.getVisibleIssues for query */
    var allIssues = [];
    var self = this;
    var url = '/orgs/' + org + '/issues?' + querystring.stringify(query);
    this.get(url, _onResponse);

    // this is to handle pagination of github
    function _onResponse(err, issues, links) {
      allIssues = allIssues.concat(issues);
      if (links && links.next)
        self.get(links.next, _onResponse);
      else
        callback(err, allIssues);
    }
  };

Adapter.prototype.getRepositoryIssues =
  function (owner, repo, query, callback) {
    // Issues from a repository
    /* Query object options:
     *  milestone: integer milestone number, '*' (all), or 'none' (no milestone)
     *    Default: '*''
     *  state: 'open', 'closed', or 'all' Default: 'open'
     *  assignee: username, 'none', or '*' Default: '*'
     *  creator: user
     *  mentioned: user
     *  labels: comma-separated label names
     *  sort: 'created', 'updated', or 'comments' Default: 'created'
     *  direction (of sort): 'asc' or 'desc' Default: 'desc'
     *  since: updated since ISO 8601 format timestamp: YYYY-MM-DDTHH:MM:SSZ
     */

    var url = '/repos/' + owner + '/' + repo + '/issues?' +
      querystring.stringify(query);
    this.get(url, callback);
  };

Adapter.prototype.searchRepositoryIssues = function (query, callback) {
  // Search issues on Github
  /* query object options:
   *  repo: repository to limit search to in form of ownerName/repoName
   *  type:
   */

  var url = '/search/issues?q=' + querystring.stringify(query, '+', ':') +
    '&per_page=100';
  this.get(url, callback);
};

Adapter.prototype.pushRespositoryIssue =
  function (owner, repo, json, callback) {
    // Create new issue in respository - user must have pull access to repo
    /*  json object properties:
     *   title: string - *required*
     *   body: string - contents of the issue
     *   assignee: username - user must have push access or this is ignored
     *   milestone: integer, milestone id - user must have push access
     *   labels: [strings] - array of label titles - user must have push access
     */

    var url = '/repos/' + owner + '/' + repo + '/issues';
    this.post(url, json, callback);
  };

Adapter.prototype.getPullRequests = function (fullName, query, callback) {
  /* Query object options:
   *  state: 'open', 'closed', or 'all' Default: 'open'
   *  head: user:branch name
   *  base: branch name
   *  sort: created, updated, popularity (comment count)
   *         or long-running (age, filtering by pulls updated in the last month)
   *  direction (of sort): 'asc' or 'desc'
   *                        Default: 'desc' for 'created', otherwise 'asc'
   */

  var allPullRequests = [];
  var self = this;
  var url = '/repos/' + fullName + '/pulls?' + querystring.stringify(query);

  this.get(url, _onResponse);

  // this is to handle pagination of github
  function _onResponse(err, repos, links) {
    allPullRequests = allPullRequests.concat(repos);
    if (links && links.next)
      self.get(links.next, _onResponse);
    else
      callback(err, allPullRequests);
  }
};

Adapter.prototype.updatePullRequest = function (fullName, number, state,
  callback) {
  var url = '/repos/' + fullName + '/pulls/' + number;
  var body = {
    state: state
  };
  this.patch(url, body, callback);
};

Adapter.prototype.postCommitStatus =
  function (owner, repo, sha, status, callback) {
    var url = '/repos/' + owner + '/' + repo + '/statuses/' + sha;
    this.post(url, status, callback);
  };

Adapter.prototype.postHook = function (owner, repo, apiUrl, callback) {
  var url = '/repos/' + owner + '/' + repo + '/hooks';
  var body = {
    name: 'web',
    events: ['push', 'pull_request', 'release'],
    config: {
      url: apiUrl
    }
  };
  this.post(url, body, callback);
};

Adapter.prototype.putContentToRepo =
  function (owner, repoName, path, commitMessage, contentBase64, callback) {
    /*  GitHub PUT /repos/:owner/:repo/contents/:path
     *   :repo is the name of the repository
     *   :path is fileName.extension (ie shippable.yml)
     *   contentBase64: commands in ASCII format, converted to base64 below
     */
    var url = '/repos/' + owner + '/' + repoName + '/contents/' + path;
    var body = {
      message: commitMessage,
      content: contentBase64
    };
    this.put(url, body, callback);
  };


Adapter.prototype.deleteHook = function (owner, repo, hookId, callback) {
  var url = '/repos/' + owner + '/' + repo + '/hooks/' + hookId;
  this.del(url, callback);
};

Adapter.prototype.getHooks = function (owner, repo, callback) {
  var url = '/repos/' + owner + '/' + repo + '/hooks';
  this.get(url, callback);
};

Adapter.prototype.postDeployKey = function (owner, repo, key, title, callback) {
  var url = '/repos/' + owner + '/' + repo + '/keys';
  var body = {
    title: title,
    key: key
  };
  this.post(url, body, callback);
};

Adapter.prototype.deleteDeployKey =
  function (owner, repo, keyId, callback) {
    var url = '/repos/' + owner + '/' + repo + '/keys/' + keyId;
    this.del(url, callback);
  };

Adapter.prototype.getDeployKeys = function (owner, repo, callback) {
  var url = '/repos/' + owner + '/' + repo + '/keys';
  this.get(url, callback);
};

Adapter.prototype.getReference =
  function (owner, repo, branch, callback) {
    if (branch)
      branch = encodeURIComponent(branch);
    var url = '/repos/' + owner + '/' + repo + '/git/refs/heads/' + branch;
    this.get(url, callback);
  };

Adapter.prototype.getTagRef =
  function (owner, repo, tag, callback) {
    if (tag)
      tag = encodeURIComponent(tag);
    var url = '/repos/' + owner + '/' + repo + '/git/refs/tags/' + tag;
    this.get(url, callback);
  };

Adapter.prototype.getContents = function (owner, repo, path, callback) {
  var url = '/repos/' + owner + '/' + repo + '/contents/' + path;
  this.get(url, callback);
};

Adapter.prototype.getAnnotatedTag =
  function (owner, repo, tag, callback) {
    if (tag)
      tag = encodeURIComponent(tag);
    var url = '/repos/' + owner + '/' + repo + '/git/tags/' + tag;
    this.get(url, callback);
  };

Adapter.prototype.getCommitContent =
  function (owner, repo, sha, callback) {
    var url = '/repos/' + owner + '/' + repo + '/commits/' + sha;
    this.get(url, callback);
  };

Adapter.prototype.getCompareDiff =
  function (owner, repo, oldSha, newSha, callback) {
    var url = '/repos/' + owner + '/' + repo + '/compare/' + oldSha + '...' +
      newSha;
    this.get(url, callback);
  };

Adapter.prototype.getRepositoryContent =
  function (owner, repo, filePath, ref, callback) {
    var url = '/repos/' + owner + '/' + repo + '/contents/' + filePath;
    if (ref)
      url = url + '?ref=' + ref;

    this.get(url, callback);
  };

Adapter.prototype.getTree = function (owner, repo, sha, callback) {
  var url = '/repos/' + owner + '/' + repo + '/git/trees/' + sha;
  this.get(url, callback);
};

Adapter.prototype.getPullRequest =
  function (owner, repo, pullRequestNumber, callback) {
    var url = '/repos/' + owner + '/' + repo + '/pulls/' + pullRequestNumber;
    this.get(url, callback);
  };

Adapter.prototype.getPullRequestFiles =
  function (owner, repo, prNumber, callback) {
    var allFiles = [];
    var self = this;
    var url = '/repos/' + owner + '/' + repo + '/pulls/' + prNumber + '/files';

    this.get(url, _onResponse, true);

    // this is to handle pagination of github
    function _onResponse(err, files, links) {
      allFiles = allFiles.concat(files);
      if (links && links.next)
        self.get(links.next, _onResponse);
      else
        callback(err, allFiles);
    }
  };

Adapter.prototype.createRelease =
  function (fullName, tagName, targetCommitish, name, body, isDraft,
    isPrerelease, callback) {
    /*  POST /repos/:owner/:repo/releases
     *   :tag_name The name of the tag
     *   :target_commitish Specifies the commitish value that determines where
     *                     the Git tag is created from. Can be any branch or
     *                     commit SHA. Unused if the Git tag already exists.
     *                     Default: the repository's default
     *                     branch (usually master)
     *   name: The name of the release
     *   body: Text describing the contents of the tag
     *   draft: true to create a draft (unpublished) release,
     *          false to create a published one. Default: false
     *   prerelease: true to identify the release as a prerelease.
     *               false to identify the release as a full release.
     *               Default: false
     */
    var url = '/repos/' + fullName + '/releases';
    var json = {
      tag_name: tagName,
      target_commitish: targetCommitish,
      name: name,
      body: body,
      draft: isDraft,
      prerelease: isPrerelease
    };
    this.post(url, json, callback);
  };
