const mongoose = require('mongoose');
const Produto = require('../models/Produto');
require('dotenv').config();

const LIMITE = 31000;
const DIVISOR = 100;
const aplicar = process.argv.includes('--aplicar');

async function executar() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI não está configurada.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const afetados = await Produto.find({ preco: { $gt: LIMITE } })
    .select('_id nome preco precoPersonalizado')
    .lean();

  console.log(`Produtos encontrados: ${afetados.length}`);
  afetados.forEach(produto => {
    console.log(`${produto.nome}: preco ${produto.preco} -> ${(produto.preco / DIVISOR).toFixed(2)} | venda preservada: ${produto.precoPersonalizado ?? 'vazia'}`);
  });

  if (aplicar && afetados.length > 0) {
    const resultado = await Produto.updateMany(
      { preco: { $gt: LIMITE } },
      { $mul: { preco: 1 / DIVISOR } }
    );
    console.log(`Produtos corrigidos: ${resultado.modifiedCount}`);
  } else if (!aplicar) {
    console.log('Prévia concluída. Use --aplicar para executar a alteração.');
  }
}

executar()
  .catch(erro => {
    console.error('Erro ao corrigir preços:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
