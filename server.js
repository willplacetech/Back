require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // ✅ Gemini

// 📥 Importa rotas
const produtoRoutes = require('./routes/produtos');
const pedidoRoutes = require('./routes/pedidos');
const mlRoutes = require('./routes/mercadolivre');
const authRoutes = require('./routes/auth');

const app = express();

// ⚙️ Configurações do Mongoose
mongoose.set('strictQuery', true);

// 🛡️ Middlewares — SEMPRE ANTES DAS ROTAS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://placetechcatalogo.netlify.app',
    'https://front-eazr.onrender.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '2mb' })); // ✅ Aumentado para listas grandes
app.use(express.urlencoded({ extended: true }));

// 🤖 Inicializa Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function dividirListaEmLotes(texto, tamanhoLote = 50) {
  const blocos = texto.split(/\r?\n\s*\r?\n/).map(bloco => bloco.trim()).filter(Boolean);
  const lotes = [];
  let categoriaAtual = '';

  for (let inicio = 0; inicio < blocos.length; inicio += tamanhoLote) {
    const blocoAtual = blocos.slice(inicio, inicio + tamanhoLote);
    const conteudo = blocoAtual.map(bloco => {
      const categoria = bloco.split(/\r?\n/).find(linha => linha.includes('⬇️'));
      if (categoria) categoriaAtual = categoria;
      return categoriaAtual && !bloco.includes('⬇️')
        ? `${categoriaAtual}\n${bloco}`
        : bloco;
    });
    lotes.push(conteudo.join('\n\n'));
  }

  return lotes.length ? lotes : [texto];
}

// ✨ NOVA ROTA — Processa lista bruta → JSON estruturado
app.post('/api/produtos/processar-lista', async (req, res) => {
  try {
    const { listaBruta } = req.body;

    if (!listaBruta || listaBruta.trim().length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'O campo listaBruta é obrigatório'
      });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const criarPrompt = (lote) => `
Você é um processador de produtos. Sua tarefa:
1. Extraia TODOS os produtos da lista abaixo
2. Retorne APENAS JSON válido seguindo exatamente este formato:

{
  "categorias": [
    {
      "nomeCategoria": "nome da seção/categoria",
      "produtos": [
        {
          "nome": "nome completo do produto",
          "cor": "cor",
          "capacidade": "ex: 256GB",
          "preco": "R$ X.XXX,XX",
          "imagemUrl": "link de busca oficial do produto",
          "descricao": "descrição técnica do produto"
        }
      ]
    }
  ]
}

REGRAS:
- imagemUrl: crie link de busca padrão do produto (ex: site oficial Apple/fabricante)
- descricao: escreva especificações reais do produto com informações conhecidas
- NÃO adicione comentários, NÃO use blocos de código
- Retorne APENAS JSON, sem texto adicional

Lista para processar:
${lote}
`;

    const lotes = dividirListaEmLotes(listaBruta, 50);
    const categoriasMap = new Map();

    for (const lote of lotes) {
      const resultado = await model.generateContent(criarPrompt(lote));
      const dadosLote = JSON.parse(resultado.response.text());

      for (const categoria of dadosLote.categorias || []) {
        const nomeCategoria = categoria.nomeCategoria || 'Sem categoria';
        const categoriaExistente = categoriasMap.get(nomeCategoria);
        if (categoriaExistente) {
          categoriaExistente.produtos.push(...(categoria.produtos || []));
        } else {
          categoriasMap.set(nomeCategoria, {
            ...categoria,
            produtos: categoria.produtos || []
          });
        }
      }
    }

    const dados = { categorias: [...categoriasMap.values()] };

    res.json({
      sucesso: true,
      mensagem: `✅ ${dados.categorias.length} categorias processadas em ${lotes.length} lote(s)`,
      dados
    });

  } catch (erro) {
    console.error('❌ Erro no processamento:', erro);
    res.status(500).json({
      sucesso: false,
      erro: erro.message || 'Falha ao processar lista'
    });
  }
});

// 🛣️ Rotas da API
app.use('/api/auth', authRoutes);
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
  console.log(`🤖 Processador de Lista: http://localhost:${PORT}/api/produtos/processar-lista`);
});