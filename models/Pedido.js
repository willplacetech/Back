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
    nome: { type: String, default: 'Nome não informado' }, // ✅ Sem required, tem valor padrão
    telefone: { type: String, default: '' },
    endereco: { type: String, default: '' }
  },
  status: { type: String, default: 'pendente' },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', PedidoSchema);