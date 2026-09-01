require('dotenv').config();
const mongoose = require('mongoose');
const Produto = require('../models/Produto');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'catalogo' });
  const total = await Produto.countDocuments();
  const comImagem = await Produto.countDocuments({
    imagem: { $exists: true, $ne: '', $ne: null }
  });
  const semImagem = await Produto.countDocuments({
    $or: [
      { imagem: { $exists: false } },
      { imagem: '' },
      { imagem: null }
    ]
  });

  console.log('TOTAL_PRODUTOS', total);
  console.log('COM_IMAGEM', comImagem);
  console.log('SEM_IMAGEM', semImagem);

  const primeiros = await Produto.find({}, { nome: 1, imagem: 1 }).limit(5).lean();
  console.log('AMOSTRA', JSON.stringify(primeiros, null, 2));

  await mongoose.disconnect();
})();
