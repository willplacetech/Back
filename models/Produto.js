const mongoose = require('mongoose');

// 1️⃣ PRIMEIRO define o Schema
const ProdutoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true
  },
  descricao: {
    type: String,
    default: ''
  },
  preco: {
    type: Number,
    required: true
  },
  precoPersonalizado: {
    type: Number,
    default: null
  },
  categoria: {
    type: String,
    default: ''
  },
  imagem: {
    type: String,
    default: ''
  },
  disponivel: {
    type: Boolean,
    default: true
  },
  criadoEm: {
    type: Date,
    default: Date.now
  }
});

// 2️⃣ DEPOIS cria o Model
module.exports = mongoose.model('Produto', ProdutoSchema);