const mongoose = require('mongoose');
const { imeiValido } = require('../utils/imei');

const contatoObrigatorio = function () { return !this.userId; };
const urlFoto = valor => {
  try { return ['http:', 'https:'].includes(new URL(valor).protocol); }
  catch { return false; }
};
const foto = () => ({ type: String, required: true, maxlength: 2048, validate: { validator: urlFoto, message: 'Foto deve ser uma URL HTTP/HTTPS.' } });

const TradeInSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nome: { type: String, trim: true, maxlength: 120, required: contatoObrigatorio },
  email: {
    type: String, trim: true, lowercase: true, maxlength: 254, required: contatoObrigatorio,
    validate: { validator: valor => !valor || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor), message: 'Email inválido.' }
  },
  telefone: { type: String, trim: true, maxlength: 25, required: contatoObrigatorio },
  modeloAparelho: { type: String, required: true, trim: true, maxlength: 180 },
  capacidade: { type: String, required: true, trim: true, maxlength: 80 },
  cor: { type: String, required: true, trim: true, maxlength: 80 },
  imei: {
    type: String, required: true, unique: true,
    match: [/^[0-9]{15}$/, 'IMEI deve conter exatamente 15 dígitos.'],
    validate: { validator: imeiValido, message: 'Checksum Luhn do IMEI inválido.' }
  },
  descricaoEstado: { type: String, trim: true, maxlength: 4000, default: '' },
  fotos: {
    frontal: foto(), superior: foto(), inferior: foto(), lateralEsq: foto(), lateralDir: foto()
  },
  status: {
    type: String, enum: ['pendente', 'em_avaliacao', 'aprovado', 'rejeitado', 'concluido'], default: 'pendente'
  },
  valorOferta: { type: Number, min: 0, default: null, validate: valor => valor === null || Number.isFinite(valor) },
  motivoRejeicao: { type: String, trim: true, maxlength: 2000, default: '' },
  // Permite acompanhar uma solicitação sem conta, sem expor dados apenas pelo ID.
  acessoTokenHash: { type: String, select: false }
  ,cloudinaryAssets: { type: [{ campo: String, publicId: String, _id: false }], select: false }
}, { timestamps: true });

TradeInSchema.index({ userId: 1, createdAt: -1 });
TradeInSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TradeIn', TradeInSchema);
