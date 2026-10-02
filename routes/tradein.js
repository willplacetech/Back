const express = require('express');
const ctrl = require('../controllers/tradeInController');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const { resolverTrocaUser, requireTrocaUser } = require('../middleware/trocaUser');
const { uploadTroca } = require('../middleware/uploadTroca');
const router = express.Router();

router.post('/', optionalAuth, resolverTrocaUser, uploadTroca, ctrl.criar);
// Rotas fixas precisam preceder /:id.
router.get('/mid', requireAuth, resolverTrocaUser, requireTrocaUser, ctrl.listarMinhas);
router.get('/admin', requireAdmin, ctrl.listarAdmin);
router.patch('/:id/status', requireAdmin, ctrl.atualizarStatus);
router.get('/:id', optionalAuth, resolverTrocaUser, ctrl.buscarPorId);

module.exports = router;
