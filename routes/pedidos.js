const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pedidoController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { resolverTrocaUser } = require('../middleware/trocaUser');

router.get('/', ctrl.listar);
router.post('/', optionalAuth, resolverTrocaUser, ctrl.criar);
router.put('/:id/status', requireAuth, ctrl.atualizarStatus);

module.exports = router;
