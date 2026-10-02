const multer = require('multer');

const CAMPOS_FOTOS = ['frontal', 'superior', 'inferior', 'lateralEsq', 'lateralDir', 'traseira'];
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LIMITE_FOTO = 5 * 1024 * 1024;

function assinaturaValida(buffer, tipo) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (tipo === 'image/jpeg') return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (tipo === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return tipo === 'image/webp' && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

const receber = multer({
  // Os buffers existem só durante a requisição; nunca são salvos no MongoDB.
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_FOTO, files: 5, fields: 12, parts: 17, fieldSize: 16000, fieldNameSize: 100 },
  fileFilter(req, file, callback) {
    if (!TIPOS.has(file.mimetype)) return callback(Object.assign(new Error('Fotos devem ser JPEG, PNG ou WebP'), { status: 415 }));
    callback(null, true);
  }
}).fields(CAMPOS_FOTOS.map(name => ({ name, maxCount: 1 })));

function uploadTroca(req, res, next) {
  if (!req.is('multipart/form-data')) return res.status(415).json({ sucesso: false, error: 'Envie multipart/form-data com as seis fotos' });
  receber(req, res, erro => {
    if (erro) {
      const mensagem = erro.code === 'LIMIT_FILE_SIZE' ? 'Cada foto deve ter no máximo 5 MB'
        : erro instanceof multer.MulterError ? 'Upload inválido: envie uma foto por campo e respeite os limites do formulário'
          : erro.status ? erro.message : 'Não foi possível receber as fotos';
      return res.status(erro.code === 'LIMIT_FILE_SIZE' ? 413 : erro.status || 400).json({ sucesso: false, error: mensagem });
    }
    if (CAMPOS_FOTOS.some(campo => !req.files?.[campo]?.[0])) return res.status(400).json({ sucesso: false, error: `Envie as seis fotos: ${CAMPOS_FOTOS.join(', ')}` });
    for (const campo of CAMPOS_FOTOS) {
      const file = req.files[campo][0];
      if (!assinaturaValida(file.buffer, file.mimetype)) return res.status(415).json({ sucesso: false, error: `A foto ${campo} não corresponde ao formato informado` });
    }
    next();
  });
}

module.exports = { uploadTroca, CAMPOS_FOTOS, LIMITE_FOTO, assinaturaValida };
