const mongoose = require('mongoose');
const Produto = require('../models/Produto');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const total = await Produto.countDocuments({});
  const com = await Produto.countDocuments({ 
    imagem: { $exists: true, $ne: '', $ne: null } 
  });
  const sem = await Produto.countDocuments({ 
    $or: [
      { imagem: { $exists: false } }, 
      { imagem: '' }, 
      { imagem: null }
    ] 
  });

  console.log('📊 Resumo de Imagens:');
  console.log('📦 Total:', total);
  console.log('✅ Com imagem:', com);
  console.log('❌ Sem imagem:', sem);
  
  if (total > 0) {
    const percentual = ((com / total) * 100).toFixed(1);
    console.log('📈 Percentual:', percentual + '%');
  }

  process.exit(0);
}).catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
