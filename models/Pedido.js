const mongoose = require('mongoose');

const PedidoSchema = new mongoose.Schema({
  itens: [{
    produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
    nome: String,
    preco: { type: Number, required: true, min: 0.01 },
    quantidade: { type: Number, required: true, min: 1, validate: Number.isInteger },
    imagem: String
  }],
  total: { type: Number, required: true, min: 0.01 },
  dadosCliente: {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    telefone: { type: String, required: true, trim: true, maxlength: 25 },
    endereco: { type: String, default: '' }
  },
  status: { type: String, enum: ['pendente', 'confirmado', 'entregue', 'cancelado'], default: 'pendente' },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', PedidoSchema);