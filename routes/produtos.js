const express = require('express');
const router = express.Router();

// ✅ CAMINHO CORRETO — verifique se o caminho está certo!
const produtoController = require('../controllers/produtoController');

// ✅ ROTAS com nomes IGUAIS aos do controller
router.get('/', produtoController.listar);
router.get('/disponiveis', produtoController.listarDisponiveis);
router.get('/categoria/:categoria', produtoController.buscarPorCategoria);
router.get('/:id', produtoController.buscarPorId);
router.post('/', produtoController.criar);
router.put('/:id', produtoController.atualizar);
router.delete('/:id', produtoController.excluir);

module.exports = router;