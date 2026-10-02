const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'placetech-dev-secret';

function requireAuth(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const parts = authorization.trim().split(' ');
    
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }

    const [scheme, token] = parts;

    if (scheme !== 'Bearer') {
      return res.status(401).json({ error: 'Esquema de autenticação inválido' });
    }

    if (!token) {
      return res.status(401).json({ error: 'Token ausente' });
    }

    const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    req.admin = jwt.verify(token, jwtSecret);
    req.auth = req.admin;
    return next();
  } catch (error) {
    console.error('❌ Erro de autenticação:', error.message);
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

function optionalAuth(req, res, next) {
  if (!req.get('authorization')) return next();
  return requireAuth(req, res, next);
}

function isAdmin(auth) {
  return auth?.perfil === 'admin' || auth?.role === 'admin';
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!isAdmin(req.auth)) return res.status(403).json({ error: 'Acesso exclusivo de administrador' });
    next();
  });
}

module.exports = { requireAuth, optionalAuth, requireAdmin, isAdmin };
