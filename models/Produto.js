const mongoose = require('mongoose');

// 1️⃣ PRIMEIRO define o Schema
const ProdutoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180
  },
  descricao: {
    type: String,
    default: '',
    maxlength: 600
  },
  preco: {
    type: Number,
    required: true,
    min: 0.01
  },
  precoPersonalizado: {
    type: Number,
    default: null,
    min: 0.01
  },
  categoria: {
    type: String,
    default: ''
  },
  imagem: {
    type: String,
    default: ''
  },
  galeria: {
    type: [String],
    default: []
  },
  linkML: {
    type: String,
    default: ''
  },
  mlId: {
    type: String,
    sparse: true,
    unique: true
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