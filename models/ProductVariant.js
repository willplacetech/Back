const mongoose = require('mongoose');

// Subdocumento: cada combinação pertence ao documento do modelo.
const ProductVariantSchema = new mongoose.Schema({
  cor: { type: String, required: true, trim: true, maxlength: 80 },
  capacidade: { type: String, required: true, trim: true, maxlength: 80 },
  preco: { type: Number, required: true, min: 0.01 },
  // null = sob encomenda; zero = esgotado; inteiro positivo = estoque físico.
  estoque: { type: Number, default: null, min: 0, validate: v => v === null || Number.isInteger(v) },
  sku: { type: String, required: true, trim: true, maxlength: 120 },
  imagens: { type: [String], default: [] },
  disponivel: { type: Boolean, default: true },
  produtoLegadoId: { type: mongoose.Schema.Types.ObjectId },
  nomeLegado: { type: String, trim: true },
  mlId: String,
  linkML: String,
  // Mantém o custo separado do preço de venda usado pelo catálogo/carrinho.
  precoCusto: { type: Number, min: 0.01 }
});

module.exports = ProductVariantSchema;
