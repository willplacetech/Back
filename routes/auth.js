const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolverTrocaUser } = require('../middleware/trocaUser');

const router = express.Router();

router.post('/login', authController.login);
router.get('/admin', requireAdmin, (req, res) => res.json({ admin: true }));
router.get('/me', requireAuth, resolverTrocaUser, (req, res) => {
  const user = req.user;
  res.json({ user: user ? { nome: user.nome, email: user.email, telefone: user.telefone } : null });
});

module.exports = router;
