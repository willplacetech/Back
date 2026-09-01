const mongoose = require('mongoose');
const Produto = require('../models/Produto');
require('dotenv').config();

async function executar() {
  await mongoose.connect(process.env.MONGODB_URI);
  const grupos = await Produto.aggregate([
    { $group: {
      _id: { $toLower: '$nome' },
      registros: { $push: { id: '$_id', nome: '$nome', preco: '$preco', venda: '$precoPersonalizado', criadoEm: '$criadoEm' } },
      total: { $sum: 1 }
    } },
    { $match: { total: { $gt: 1 } } },
    { $sort: { total: -1 } }
  ]);
  console.log(`Grupos duplicados: ${grupos.length}`);
  grupos.forEach(grupo => console.log(JSON.stringify(grupo.registros)));
}

executar().catch(erro => { console.error(erro.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
