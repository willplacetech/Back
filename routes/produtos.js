const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/produtoController');

router.get('/', ctrl.listar);
router.get('/disponiveis', ctrl.listarDisponiveis);
router.get('/relatorio', ctrl.relatorio);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.deletar);

module.exports = router;