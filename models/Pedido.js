const mongoose = require('mongoose');

const PedidoSchema = new mongoose.Schema({
  itens: [{
    produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
    variantId: mongoose.Schema.Types.ObjectId,
    sku: String,
    cor: String,
    capacidade: String,
    nome: String,
    preco: { type: Number, required: true, min: 0.01 },
    quantidade: { type: Number, required: true, min: 1, validate: Number.isInteger },
    imagem: String
  }],
  tradeInId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeIn', default: null },
  valorTroca: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  dadosCliente: {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    telefone: { type: String, required: true, trim: true, maxlength: 25 },
    endereco: { type: String, default: '' }
  },
  status: { type: String, enum: ['pendente', 'confirmado', 'entregue', 'cancelado'], default: 'pendente' },
  criadoEm: { type: Date, default: Date.now }
});

// A mesma troca só financia um pedido ativo, inclusive com requisições simultâneas.
PedidoSchema.index({ tradeInId: 1 }, {
  name: 'troca_pedido_ativo_unico', unique: true,
  partialFilterExpression: { tradeInId: { $type: 'objectId' }, status: { $in: ['pendente', 'confirmado', 'entregue'] } }
});

module.exports = mongoose.model('Pedido', PedidoSchema);
