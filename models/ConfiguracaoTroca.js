const mongoose = require('mongoose');

const ConfiguracaoTrocaSchema = new mongoose.Schema({
  chave: { type: String, required: true, unique: true, enum: ['troca'] },
  checklist: {
    type: [{ type: String, trim: true, maxlength: 200 }],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('ConfiguracaoTroca', ConfiguracaoTrocaSchema);
