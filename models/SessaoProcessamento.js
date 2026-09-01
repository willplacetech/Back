const mongoose = require('mongoose');

const loteSchema = new mongoose.Schema({
  indice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pendente', 'processando', 'concluido', 'falhou'],
    default: 'pendente'
  },
  produtos: [{ type: mongoose.Schema.Types.Mixed }],
  erro: String,
  tentativas: { type: Number, default: 0 },
  iniciadoEm: Date,
  concluidoEm: Date
});

const sessaoSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['iniciada', 'processando', 'concluida', 'parcial', 'falhou'],
    default: 'iniciada'
  },
  listaBruta: { type: String, required: true },
  totalLotes: { type: Number, default: 0 },
  lotesConcluidos: { type: Number, default: 0 },
  lotesFalhos: { type: Number, default: 0 },
  totalProdutos: { type: Number, default: 0 },
  lotes: [loteSchema],
  produtos: [{ type: mongoose.Schema.Types.Mixed }],
  criadaEm: { type: Date, default: Date.now },
  atualizadaEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SessaoProcessamento', sessaoSchema);