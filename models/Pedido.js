const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto' },
  nome: String,
  preco: Number,
  quantidade: Number
});

const pedidoSchema = new mongoose.Schema({
  cliente: {
    nome: String,
    telefone: String,
    endereco: String
  },
  itens: [itemSchema],
  total: Number,
  status: {
    type: String,
    enum: ['pendente', 'confirmado', 'entregue', 'cancelado'],
    default: 'pendente'
  }
}, { timestamps: true });

module.exports = mongoose.model('Pedido', pedidoSchema);