const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { buscarImagemProduto } = require('../utils/imagemSearch');
require('dotenv').config();

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está configurada.');
  await mongoose.connect(process.env.MONGODB_URI);

  const produtos = await Produto.find({ $or: [{ imagem: '' }, { imagem: { $exists: false } }] })
    .select('_id nome')
    .lean();
  console.log(`Produtos sem imagem: ${produtos.length}`);

  let encontrados = 0;
  for (let inicio = 0; inicio < produtos.length; inicio += 5) {
    const lote = produtos.slice(inicio, inicio + 5);
    await Promise.all(lote.map(async produto => {
      const imagem = await buscarImagemProduto(produto.nome, {
        unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
        pixabayKey: process.env.PIXABAY_API_KEY,
        tentarBing: true
      });
      if (imagem) {
        await Produto.updateOne({ _id: produto._id, $or: [{ imagem: '' }, { imagem: { $exists: false } }] }, { $set: { imagem } });
        encontrados += 1;
        console.log(`Imagem encontrada: ${produto.nome}`);
      } else {
        console.log(`Sem resultado: ${produto.nome}`);
      }
    }));
  }

  console.log(`Imagens preenchidas: ${encontrados}/${produtos.length}`);
}

executar()
  .catch(erro => {
    console.error('Erro ao preencher imagens:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
