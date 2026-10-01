const mongoose = require('mongoose');

function produtosMatriz() {
  return ['Prata', 'Deep Blue', 'Cosmic Orange'].flatMap((cor, indiceCor) => ['256GB', '512GB', '1TB'].map((capacidade, indiceCapacidade) => ({
    _id: new mongoose.Types.ObjectId((indiceCor * 3 + indiceCapacidade + 1).toString(16).padStart(24, '0')),
    nome: `iPhone 17 Pro Max ${capacidade} ${cor}`,
    categoria: 'iPhones Lacrados',
    preco: 6000 + indiceCor * 100 + indiceCapacidade * 500,
    precoPersonalizado: 7500 + indiceCor * 100 + indiceCapacidade * 500,
    disponivel: true,
    imagem: `https://example.com/${indiceCor}.jpg`,
    criadoEm: new Date('2026-09-01T12:00:00Z')
  })));
}

module.exports = { produtosMatriz };
