require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 📥 Importa rotas
const produtoRoutes = require('./routes/produtos');
const pedidoRoutes = require('./routes/pedidos');
const mlRoutes = require('./routes/mercadolivre');

const app = express();

// ⚙️ Configurações do Mongoose
mongoose.set('strictQuery', true);

// 🛡️ Middlewares — SEMPRE ANTES DAS ROTAS
app.use(cors({
  origin: ['http://localhost:5173', 'https://placetechcatalogo.netlify.app'],
  credentials: true
}));

app.use(express.json());       // ✅ LÊ JSON DO FRONTEND — MAIS IMPORTANTE
app.use(express.urlencoded({ extended: true }));

// 🛣️ Rotas da API
app.use('/api/produtos', produtoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/ml', mlRoutes);

// 🧪 Rota de teste
app.get('/api', (req, res) => {
  res.json({ mensagem: 'API da Loja rodando! 🚀' });
});

// 🔗 Conectar no MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas CONECTADO com sucesso!'))
  .catch((err) => console.log('❌ Erro ao conectar MongoDB:', err.message));

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📚 API disponível em: http://localhost:${PORT}/api`);
});