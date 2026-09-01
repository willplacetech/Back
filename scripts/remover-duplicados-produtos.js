const mongoose = require('mongoose');
const Produto = require('../models/Produto');
require('dotenv').config();

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está configurada.');
  await mongoose.connect(process.env.MONGODB_URI);

  const grupos = await Produto.aggregate([
    { $group: {
      _id: { $toLower: { $trim: { input: '$nome' } } },
      ids: { $push: '$_id' },
      total: { $sum: 1 }
    } },
    { $match: { total: { $gt: 1 } } }
  ]);

  let removidos = 0;
  let gruposProcessados = 0;

  for (const grupo of grupos) {
    const registros = await Produto.find({ _id: { $in: grupo.ids } }).sort({ criadoEm: -1 });
    const manter = registros[0];
    const remover = registros.slice(1);
    const dadosPreservados = {};

    if (!manter.imagem) {
      const comImagem = remover.find(produto => produto.imagem);
      if (comImagem) dadosPreservados.imagem = comImagem.imagem;
    }
    if (!manter.descricao) {
      const comDescricao = remover.find(produto => produto.descricao);
      if (comDescricao) dadosPreservados.descricao = comDescricao.descricao;
    }
    if (Object.keys(dadosPreservados).length > 0) {
      await Produto.updateOne({ _id: manter._id }, { $set: dadosPreservados });
    }

    await Produto.deleteMany({ _id: { $in: remover.map(produto => produto._id) } });
    removidos += remover.length;
    gruposProcessados += 1;
  }

  console.log(`Grupos limpos: ${gruposProcessados}`);
  console.log(`Registros removidos: ${removidos}`);
}

executar()
  .catch(erro => { console.error('Erro ao remover duplicados:', erro.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
