const mongoose = require('mongoose');
const ProductVariantSchema = require('./ProductVariant');

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
  marca: { type: String, trim: true, default: '' },
  chaveModelo: { type: String, unique: true, sparse: true },
  specs: {
    tela: { type: String, default: '' },
    chip: { type: String, default: '' },
    camera: { type: String, alias: 'specs.câmera', default: '' },
    bateria: { type: String, default: '' },
    '5g': { type: Boolean, default: null }
  },
  variants: {
    type: [ProductVariantSchema],
    default: [],
    validate: {
      validator: variants => new Set(variants.map(v => v.sku)).size === variants.length &&
        new Set(variants.map(v => `${v.cor.toLocaleLowerCase()}|${v.capacidade.toLocaleLowerCase()}`)).size === variants.length,
      message: 'SKU e combinação de cor/capacidade devem ser únicos no modelo.'
    }
  },
  categoriaOriginal: String,
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

ProdutoSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// 2️⃣ DEPOIS cria o Model
module.exports = mongoose.model('Produto', ProdutoSchema);
