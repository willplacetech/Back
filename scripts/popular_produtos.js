require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { LISTA_IMAGENS } = require('./carregar_lista_imagens');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'catalogo' });

  const docs = LISTA_IMAGENS.map((item) => ({
    nome: String(item.nome || '').trim(),
    preco: Number(Number(item.preco || 0).toFixed(2)),
    categoria: String(item.categoria || '').trim() || 'Sem categoria',
    imagem: String(item.imagem || '').trim(),
    descricao: 'Produto importado em lote',
    disponivel: true,
    criadoEm: new Date()
  })).filter((item) => item.nome && item.preco > 0);

  await Produto.deleteMany({});
  const result = await Produto.insertMany(docs, { ordered: false });

  const total = await Produto.countDocuments();
  const comImagem = await Produto.countDocuments({
    imagem: { $exists: true, $ne: '', $ne: null }
  });

  console.log('INSERIDOS', result.length);
  console.log('TOTAL_PRODUTOS', total);
  console.log('COM_IMAGEM', comImagem);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
