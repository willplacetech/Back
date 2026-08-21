const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ✅ CAMINHO CORRETO — verifique se o caminho está certo!
const produtoController = require('../controllers/produtoController');

// ✅ ROTAS com nomes IGUAIS aos do controller
router.get('/', requireAuth, produtoController.listar);
router.get('/relatorio', requireAuth, produtoController.relatorio);
router.get('/disponiveis', produtoController.listarDisponiveis);
router.get('/categoria/:categoria', produtoController.buscarPorCategoria);
router.get('/:id', produtoController.buscarPorId);
router.post('/', requireAuth, produtoController.criar);
router.put('/:id', requireAuth, produtoController.atualizar);
router.delete('/:id', requireAuth, produtoController.excluir);

module.exports = router;