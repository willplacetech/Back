const mongoose = require('mongoose');
const Produto = require('./models/Produto');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const produtos = await Produto.find({});
    console.log(`Total produtos: ${produtos.length}`);
    produtos.forEach(p => console.log(p.nome, 'Disponivel:', p.disponivel));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
