const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ✅ CAMINHO CORRETO — verifique se o caminho está certo!
const produtoController = require('../controllers/produtoController');

// ✅ ROTAS - ORDEM IMPORTA! Rotas específicas ANTES de genéricas com :id

// 🔐 Rotas protegidas com paths específicos
router.get('/relatorio', produtoController.relatorio);

// 📖 Rotas públicas com paths específicos
router.get('/disponiveis', produtoController.listarDisponiveis);
router.get('/categoria/:categoria', produtoController.buscarPorCategoria);

// 📖 GET raiz — lista todos (ANTES de /:id dinâmico)
router.get('/', produtoController.listar);

// 🔐 Rotas com parâmetros dinâmicos (DEPOIS das específicas)
router.get('/:id', produtoController.buscarPorId);
router.post('/', requireAuth, produtoController.criar);
router.put('/:id', requireAuth, produtoController.atualizar);
router.delete('/:id', requireAuth, produtoController.excluir);

module.exports = router;