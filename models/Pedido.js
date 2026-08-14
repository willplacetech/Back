const mongoose = require('mongoose');

const PedidoSchema = new mongoose.Schema({
  itens: [{
    nome: String,
    preco: Number,
    quantidade: Number,
    imagem: String
  }],
  total: Number,
  dadosCliente: {
    nome: String,
    telefone: String,
    endereco: String
  },
  status: { type: String, default: 'pendente' },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', PedidoSchema);