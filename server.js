require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 📥 Importa rotas
const produtoRoutes = require('./routes/produtos');
const pedidoRoutes = require('./routes/pedidos');
const mlRoutes = require('./routes/mercadolivre');
const authRoutes = require('./routes/auth');

const app = express();

// ⚙️ Configurações do Mongoose
mongoose.set('strictQuery', true);

// 🛡️ Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://placetechcatalogo.netlify.app',
    'https://front-eazr.onrender.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// 🤖 Inicializa Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ DIVIDE A LISTA EM LOTES PRESERVANDO CATEGORIAS
function dividirListaEmLotes(texto, tamanhoLote = 20) {
  const linhas = texto.split('\n').filter(l => l.trim().length > 0);
  const lotes = [];
  let blocoAtual = [];
  let contador = 0;
  let ultimaCategoria = '';

  for (const linha of linhas) {
    // Detecta linha de categoria
    if (linha.includes('⬇️') || linha.includes('---') || linha.toUpperCase().includes('LINHA')) {
      ultimaCategoria = linha.trim();
    }

    blocoAtual.push(linha);
    contador++;

    // Fecha o lote ao atingir o tamanho
    if (contador >= tamanhoLote) {
      lotes.push({
        conteudo: blocoAtual.join('\n'),
        categoriaContexto: ultimaCategoria
      });
      blocoAtual = [ultimaCategoria]; // Preserva categoria no próximo lote
      contador = 0;
    }
  }

  // Adiciona o último lote se tiver itens restantes
  if (blocoAtual.length > 0) {
    lotes.push({
      conteudo: blocoAtual.join('\n'),
      categoriaContexto: ultimaCategoria
    });
  }

  return lotes.length ? lotes : [{ conteudo: texto, categoriaContexto: '' }];
}

// ✨ ROTA PRINCIPAL — Processa lista com lotes + timeout + JSON seguro
app.post('/api/produtos/processar-lista', async (req, res) => {
  try {
    const { listaBruta } = req.body;

    if (!listaBruta || listaBruta.trim().length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'O campo listaBruta é obrigatório'
      });
    }

    // 📦 Divide em lotes
    const lotes = dividirListaEmLotes(listaBruta, 20);
    console.log(`📦 Lista dividida em ${lotes.length} lote(s) de ~20 itens`);

    // 🤖 Modelo CORRIGIDO e com configurações de segurança
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // ✅ Mais consistente, menos criativo
        maxOutputTokens: 8192 // ✅ Garante resposta completa
      }
    });

    const criarPrompt = (loteTexto, contextoCategoria) => `
${contextoCategoria ? `CONTEXTO — Categoria atual: ${contextoCategoria}` : ''}

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
- Retorne APENAS JSON, sem texto adicional, sem explicações

Lista para processar:
${loteTexto}
`;

    const categoriasMap = new Map();
    let totalProdutos = 0;

    // 🔄 Processa um lote por vez com TIMEOUT de segurança
    for (let i = 0; i < lotes.length; i++) {
      const { conteudo, categoriaContexto } = lotes[i];
      console.log(`🔄 Processando lote ${i + 1}/${lotes.length}...`);

      // ⏱️ Timeout de 30s por lote — evita travar em 88%
      const resultado = await Promise.race([
        model.generateContent(criarPrompt(conteudo, categoriaContexto)),
        new Promise((_, rejeita) =>
          setTimeout(() => rejeita(new Error(`Timeout no lote ${i + 1} (30s)`)), 30000)
        )
      ]);

      let textoResposta = resultado.response.text();

      // 🧹 LIMPA resposta — remove marcações ```json ... ``` se existirem
      textoResposta = textoResposta
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // ✅ Faz o parse com segurança
      let dadosLote;
      try {
        dadosLote = JSON.parse(textoResposta);
      } catch (parseErr) {
        console.warn(`⚠️ Lote ${i + 1} JSON incompleto, tentando reparar...`);
        // Tenta fechar JSON se foi cortado
        textoResposta = textoResposta.replace(/\}\s*$/, '').concat('}]}');
        dadosLote = JSON.parse(textoResposta);
      }

      // 📊 Junta resultados mantendo categorias unificadas
      for (const categoria of dadosLote.categorias || []) {
        const nomeCategoria = categoria.nomeCategoria?.trim() || 'Sem Categoria';
        if (!nomeCategoria || nomeCategoria.length < 2) continue;

        const existente = categoriasMap.get(nomeCategoria);
        if (existente) {
          existente.produtos.push(...(categoria.produtos || []));
        } else {
          categoriasMap.set(nomeCategoria, {
            nomeCategoria,
            produtos: categoria.produtos || []
          });
        }
        totalProdutos += (categoria.produtos?.length || 0);
      }

      console.log(`✅ Lote ${i + 1} concluído — ${totalProdutos} produtos acumulados`);
    }

    // ✅ Resposta final
    const dados = {
      categorias: [...categoriasMap.values()]
    };

    res.json({
      sucesso: true,
      mensagem: `✅ ${dados.categorias.length} categorias, ${totalProdutos} produtos em ${lotes.length} lote(s)`,
      lotesProcessados: lotes.length,
      totalProdutos,
      dados
    });

  } catch (erro) {
    console.error('❌ ERRO NO PROCESSAMENTO:', erro.message);
    res.status(500).json({
      sucesso: false,
      erro: erro.message || 'Falha ao processar lista',
      dica: erro.message?.includes('Timeout')
        ? 'Sugestão: tente reduzir o tamanho da lista ou tente novamente mais tarde'
        : undefined
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