require('dotenv').config();
const mongoose = require('mongoose');
const Produto = require('../models/Produto');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'catalogo' });
  const total = await Produto.countDocuments();
  const semImagem = await Produto.countDocuments({
    $or: [
      { imagem: { $exists: false } },
      { imagem: '' },
      { imagem: null }
    ]
  });

  console.log('TOTAL_PRODUTOS', total);
  console.log('SEM_IMAGEM', semImagem);

  const amostra = await Produto.find({
    $or: [
      { imagem: { $exists: false } },
      { imagem: '' },
      { imagem: null }
    ]
  }, { nome: 1, imagem: 1 }).limit(5).lean();

  console.log(JSON.stringify(amostra, null, 2));
  await mongoose.disconnect();
})();
