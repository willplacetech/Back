const mongoose = require('mongoose');

const produtoSchema = new mongoose.Schema({
  mlId: { type: String, unique: true, sparse: true },
  nome: { type: String, required: true },
  descricao: String,
  preco: { type: Number, required: true },
  precoPersonalizado: { type: Number, default: null },
  categoria: String,
  imagem: String,
  galeria: [String],
  linkML: String,
  disponivel: { type: Boolean, default: true },
  obsInterna: String
}, { timestamps: true });

produtoSchema.virtual('precoExibicao').get(function () {
  return this.precoPersonalizado || this.preco;
});

produtoSchema.set('toJSON', { virtuals: true });
produtoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Produto', produtoSchema);