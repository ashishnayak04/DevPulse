const githubService = require('./github.service');

async function list(req, res, next) {
  try {
    const result = await githubService.listRepositories(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function connect(req, res, next) {
  try {
    const repository = await githubService.connectRepository(req.user, req.body);
    res.status(201).json({ success: true, data: { repository } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await githubService.disconnectRepository(req.params.repositoryId, req.user.id, req.user.email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function syncNow(req, res, next) {
  try {
    const result = await githubService.syncRepositoryNow(req.params.repositoryId, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function commits(req, res, next) {
  try {
    const result = await githubService.listRepositoryCommits(req.params.repositoryId, req.user.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function deployments(req, res, next) {
  try {
    const result = await githubService.listRepositoryDeployments(req.params.repositoryId, req.user.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, connect, remove, syncNow, commits, deployments };