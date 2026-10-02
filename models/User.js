const mongoose = require('mongoose');

// Perfil de contato para a associação da Troca; não altera o login administrativo.
const UserSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido.'] },
  telefone: { type: String, trim: true, maxlength: 25, default: '' },
  ativo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
