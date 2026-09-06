const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const githubController = require('./github.controller');
const githubHookController = require('./github.hook.controller');
const { connectRepositorySchema, syncRepositorySchema } = require('./github.validators');

const router = express.Router();

// GitHub webhooks are sent by GitHub, not by a logged-in user — no bearer auth.
router.post('/hooks/deployments', githubHookController.handleHook);

router.use(verifyToken);

router.get('/repos', githubController.list);
router.post('/repos', validate(connectRepositorySchema), githubController.connect);
router.post('/repos/:repositoryId/sync', validate(syncRepositorySchema), githubController.syncNow);
router.delete('/repos/:repositoryId', githubController.remove);
router.get('/repos/:repositoryId/commits', githubController.commits);
router.get('/repos/:repositoryId/deployments', githubController.deployments);

module.exports = router;