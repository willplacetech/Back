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

// ✅ CONFIGURAÇÕES DEFINITIVAS — AJUSTE AQUI
const CONFIG = {
  TAMANHO_LOTE: 15,          // 📦 Menor ainda: 15 linhas por lote
  TIMEOUT_POR_LOTE: 60000,   // ⏱️ 60 SEGUNDOS por lote (dobro!)
  MAX_TENTATIVAS: 2,         // 🔄 Se falhar, tenta mais 1 vez automaticamente
  TEMPERATURA: 0.05,         // 🔥 Quase zero = mais rápido e direto
  MAX_TOKENS: 4096           // 📏 Menos tokens de saída = mais rápido
};

// ✅ DIVIDE EM LOTES MUITO PEQUENOS
function dividirListaEmLotes(texto) {
  const linhas = texto.split('\n').filter(l => l.trim().length > 0);
  const lotes = [];
  let blocoAtual = [];
  let contador = 0;
  let ultimaCategoria = '';

  for (const linha of linhas) {
    if (linha.includes('⬇️') || linha.includes('---') || linha.toUpperCase().includes('LINHA')) {
      ultimaCategoria = linha.trim();
    }

    blocoAtual.push(linha);
    contador++;

    if (contador >= CONFIG.TAMANHO_LOTE) {
      lotes.push({
        conteudo: blocoAtual.join('\n'),
        categoriaContexto: ultimaCategoria
      });
      blocoAtual = [ultimaCategoria];
      contador = 0;
    }
  }

  if (blocoAtual.length > 0) {
    lotes.push({
      conteudo: blocoAtual.join('\n'),
      categoriaContexto: ultimaCategoria
    });
  }

  return lotes.length ? lotes : [{ conteudo: texto, categoriaContexto: '' }];
}

// ✅ FUNÇÃO COM RETRY AUTOMÁTICO
async function processarLoteComRetry(model, loteTexto, contexto, tentativa = 1) {
  try {
    console.log(`🔄 Tentativa ${tentativa}/${CONFIG.MAX_TENTATIVAS}...`);

    // 🚀 PROMPTO MUITO MAIS CURTO E DIRETO = MAIS RÁPIDO
    const prompt = `
Categoria: ${contexto || 'Geral'}

Extraia produtos desta lista e retorne SOMENTE JSON:
{"categorias":[{"nomeCategoria":"NOME","produtos":[{"nome":"","cor":"","capacidade":"","preco":"R$","imagemUrl":"","descricao":""}]}]}

Lista:
${loteTexto}
`;

    const resultado = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, rejeita) =>
        setTimeout(() => rejeita(new Error('Timeout')), CONFIG.TIMEOUT_POR_LOTE)
      )
    ]);

    let texto = resultado.response.text()
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Tenta parsear
    try {
      return JSON.parse(texto);
    } catch {
      // Tenta reparar JSON
      if (!texto.endsWith('}')) texto = texto.replace(/,\s*$/, '') + '}]}';
      return JSON.parse(texto);
    }

  } catch (erro) {
    if (tentativa < CONFIG.MAX_TENTATIVAS) {
      console.log(`⚠️ Falhou, tentando novamente em 2s...`);
      await new Promise(r => setTimeout(r, 2000)); // Espera 2s
      return processarLoteComRetry(model, loteTexto, contexto, tentativa + 1);
    }
    throw erro;
  }
}

// ✨ ROTA PRINCIPAL
app.post('/api/produtos/processar-lista', async (req, res) => {
  try {
    const { listaBruta } = req.body;

    if (!listaBruta || listaBruta.trim().length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'O campo listaBruta é obrigatório'
      });
    }

    const lotes = dividirListaEmLotes(listaBruta);
    console.log(`📦 ${lotes.length} lote(s) de ${CONFIG.TAMANHO_LOTE} linhas | Timeout: ${CONFIG.TIMEOUT_POR_LOTE / 1000}s`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: CONFIG.TEMPERATURA,
        maxOutputTokens: CONFIG.MAX_TOKENS
      }
    });

    const categoriasMap = new Map();
    let totalProdutos = 0;
    let lotesComSucesso = 0;
    let lotesComFalha = 0;

    for (let i = 0; i < lotes.length; i++) {
      const { conteudo, categoriaContexto } = lotes[i];
      console.log(`\n📦 Lote ${i + 1}/${lotes.length}:`);

      try {
        const dadosLote = await processarLoteComRetry(model, conteudo, categoriaContexto);

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

        lotesComSucesso++;
        console.log(`✅ Lote ${i + 1} OK | Total: ${totalProdutos} produtos`);

      } catch (erroLote) {
        lotesComFalha++;
        console.error(`❌ Lote ${i + 1} FALHOU: ${erroLote.message}`);
        console.log(`⏭️ Continuando com os próximos lotes...`);
      }
    }

    if (totalProdutos === 0) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Nenhum produto foi processado. Tente novamente.'
      });
    }

    const dados = { categorias: [...categoriasMap.values()] };

    res.json({
      sucesso: true,
      mensagem: `✅ ${totalProdutos} produtos | ${lotesComSucesso} lotes OK${lotesComFalha > 0 ? ` | ${lotesComFalha} lote(s) falharam` : ''}`,
      lotesProcessados: lotes.length,
      lotesComSucesso,
      lotesComFalha,
      totalProdutos,
      dados
    });

  } catch (erro) {
    console.error('\n❌ ERRO GERAL:', erro.message);
    res.status(500).json({
      sucesso: false,
      erro: erro.message || 'Falha ao processar lista',
      dica: 'Tente novamente ou divida a lista em partes menores'
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
  res.json({
    mensagem: 'API da Loja rodando! 🚀',
    processador: {
      modelo: 'gemini-3.6-flash',
      tamanhoLote: CONFIG.TAMANHO_LOTE,
      timeoutPorLote: `${CONFIG.TIMEOUT_POR_LOTE / 1000}s`,
      maxTentativas: CONFIG.MAX_TENTATIVAS
    }
  });
});

// 🔗 Conectar no MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas CONECTADO com sucesso!'))
  .catch((err) => console.log('❌ Erro ao conectar MongoDB:', err.message));

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📚 API: http://localhost:${PORT}/api`);
  console.log(`🤖 Processador: gemini-3.6-flash`);
  console.log(`📦 Lotes: ${CONFIG.TAMANHO_LOTE} linhas | ⏱️ Timeout: ${CONFIG.TIMEOUT_POR_LOTE / 1000}s | 🔄 Retry: ${CONFIG.MAX_TENTATIVAS}x`);
});