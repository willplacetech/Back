const mongoose = require('mongoose');
const User = require('../models/User');

async function resolverTrocaUser(req, res, next) {
  try {
    // Somente identidade do JWT verificado; nunca aceita userId enviado no formulário.
    const id = req.auth?.userId || req.auth?.sub || req.auth?.id || req.auth?._id;
    if (!id) return next();
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(401).json({ error: 'Identidade de usuário inválida' });
    const user = await User.findById(id).lean();
    if (!user || user.ativo === false) return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    req.user = user;
    next();
  } catch (erro) { res.status(500).json({ error: 'Não foi possível validar o usuário' }); }
}

function requireTrocaUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login de usuário necessário' });
  next();
}

module.exports = { resolverTrocaUser, requireTrocaUser };
