const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function iguais(a, b) {
  const primeiro = Buffer.from(String(a || ''));
  const segundo = Buffer.from(String(b || ''));
  return primeiro.length === segundo.length && crypto.timingSafeEqual(primeiro, segundo);
}

exports.login = (req, res) => {
  const { usuario, senha } = req.body || {};

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Autenticação não configurada no servidor' });
  }

  if (!iguais(usuario, process.env.ADMIN_USER) || !iguais(senha, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = jwt.sign(
    { usuario: process.env.ADMIN_USER, perfil: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({ token });
};
