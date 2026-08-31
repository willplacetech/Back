const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_JWT_SECRET = 'placetech-dev-secret';

function iguais(a, b) {
  const primeiro = Buffer.from(String(a || ''));
  const segundo = Buffer.from(String(b || ''));
  return primeiro.length === segundo.length && crypto.timingSafeEqual(primeiro, segundo);
}

function getAdminConfig() {
  const adminUser = process.env.ADMIN_USER || DEFAULT_ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    console.warn('⚠️ Usando credenciais locais padrão da autenticação do admin. Defina ADMIN_USER, ADMIN_PASSWORD e JWT_SECRET em produção.');
  }

  return { adminUser, adminPassword, jwtSecret };
}

exports.login = (req, res) => {
  const { usuario, senha } = req.body || {};
  const { adminUser, adminPassword, jwtSecret } = getAdminConfig();

  if (!iguais(usuario, adminUser) || !iguais(senha, adminPassword)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = jwt.sign(
    { usuario: adminUser, perfil: 'admin' },
    jwtSecret,
    { expiresIn: '8h' }
  );

  return res.json({ token });
};
