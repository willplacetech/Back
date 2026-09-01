const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { buscarImagemProduto, validarImagemUrl } = require('../utils/imagemSearch');
require('dotenv').config();

function imagemValida(url) {
  if (!url || typeof url !== 'string') return false;
  const valor = url.trim();
  if (!valor) return false;
  return validarImagemUrl(valor);
}

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está configurada.');
  await mongoose.connect(process.env.MONGODB_URI);

  const produtos = await Produto.find({})
    .select('_id nome imagem')
    .lean();

  const produtosParaAtualizar = [];

  for (const produto of produtos) {
    const urlValida = await imagemValida(produto.imagem);
    if (!urlValida) {
      produtosParaAtualizar.push(produto);
    }
  }

  console.log(`Produtos com imagem vazia ou inválida: ${produtosParaAtualizar.length}`);

  let encontrados = 0;
  let semResultado = 0;

  for (let inicio = 0; inicio < produtosParaAtualizar.length; inicio += 5) {
    const lote = produtosParaAtualizar.slice(inicio, inicio + 5);
    const promessas = lote.map(async produto => {
      const nomeBusca = produto.nome || 'produto';
      const imagem = await buscarImagemProduto(nomeBusca, {
        unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
        pixabayKey: process.env.PIXABAY_API_KEY,
        tentarBing: true
      });

      if (imagem) {
        await Produto.updateOne({ _id: produto._id }, { $set: { imagem } });
        encontrados += 1;
        console.log(`✅ ${nomeBusca}`);
        return true;
      }

      console.log(`❌ ${nomeBusca}`);
      semResultado += 1;
      return false;
    });

    await Promise.all(promessas);
  }

  console.log(`Imagens preenchidas: ${encontrados}/${produtosParaAtualizar.length}`);
  console.log(`Sem resultado: ${semResultado}`);
}

executar()
  .catch(erro => {
    console.error('Erro ao preencher imagens:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
