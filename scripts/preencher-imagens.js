const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { buscarImagemProduto } = require('../utils/imagemSearch');
require('dotenv').config();

function imagemValida(url) {
  if (!url || typeof url !== 'string') return false;
  const valor = url.trim();
  if (!valor) return false;
  if (!/^https?:\/\//i.test(valor)) return false;
  if (/\.(?:jpg|jpeg|png|webp|gif|avif|bmp|svg)(?:\?.*)?$/i.test(valor)) return true;
  if (valor.includes('images.unsplash.com') || valor.includes('images.pexels.com') || valor.includes('pixabay.com') || valor.includes('bing.com')) return true;
  return false;
}

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está configurada.');
  await mongoose.connect(process.env.MONGODB_URI);

  const produtos = await Produto.find({})
    .select('_id nome imagem')
    .lean();

  const produtosParaAtualizar = produtos.filter(produto => !imagemValida(produto.imagem));

  console.log(`Produtos com imagem vazia ou inválida: ${produtosParaAtualizar.length}`);

  let encontrados = 0;
  for (let inicio = 0; inicio < produtosParaAtualizar.length; inicio += 5) {
    const lote = produtosParaAtualizar.slice(inicio, inicio + 5);
    await Promise.all(lote.map(async produto => {
      const nomeBusca = produto.nome || 'produto';
      const imagem = await buscarImagemProduto(nomeBusca, {
        unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
        pixabayKey: process.env.PIXABAY_API_KEY,
        tentarBing: true
      });

      if (imagem) {
        await Produto.updateOne({ _id: produto._id }, { $set: { imagem } });
        encontrados += 1;
        console.log(`Imagem encontrada: ${nomeBusca}`);
      } else {
        console.log(`Sem resultado: ${nomeBusca}`);
      }
    }));
  }

  console.log(`Imagens preenchidas: ${encontrados}/${produtosParaAtualizar.length}`);
}

executar()
  .catch(erro => {
    console.error('Erro ao preencher imagens:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
