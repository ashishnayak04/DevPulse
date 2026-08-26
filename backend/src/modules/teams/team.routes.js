const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const teamController = require('./team.controller');
const {
  createTeamSchema,
  renameTeamSchema,
  changeRoleSchema,
  inviteMemberSchema,
  attachEndpointSchema,
} = require('./team.validators');

const router = express.Router();

router.use(verifyToken);

// NOTE: literal paths MUST be registered before any '/:slug' routes.
router.get('/invites/mine', teamController.myInvites);
router.get('/invites/accept', teamController.acceptInvite);

router.post('/', validate(createTeamSchema), teamController.create);
router.get('/', teamController.list);

router.get('/:slug', teamController.detail);
router.patch('/:slug', validate(renameTeamSchema), teamController.rename);
router.delete('/:slug', teamController.remove);

router.get('/:slug/members', teamController.members);
router.patch('/:slug/members/:userId', validate(changeRoleSchema), teamController.changeRole);
router.delete('/:slug/members/:userId', teamController.removeMember);

router.post('/:slug/invites', validate(inviteMemberSchema), teamController.invite);

router.post('/:slug/endpoints', validate(attachEndpointSchema), teamController.attachEndpoint);
router.delete('/:slug/endpoints/:endpointId', teamController.detachEndpoint);

module.exports = router;
