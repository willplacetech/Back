require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 📥 Importa rotas e modelos
const produtoRoutes = require('./routes/produtos');
const pedidoRoutes = require('./routes/pedidos');
const mlRoutes = require('./routes/mercadolivre');
const authRoutes = require('./routes/auth');
const SessaoProcessamento = require('./models/SessaoProcessamento');

const app = express();

// ⚙️ Configurações
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

// ✅ CONFIGURAÇÕES
const CONFIG = {
  TAMANHO_LOTE: 15,
  TIMEOUT_POR_LOTE: 60000,
  MAX_TENTATIVAS: 2,
  TEMPERATURA: 0.05,
  MAX_TOKENS: 4096
};

// ✅ DIVIDE EM LOTES
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
      lotes.push({ conteudo: blocoAtual.join('\n'), categoriaContexto: ultimaCategoria });
      blocoAtual = [ultimaCategoria];
      contador = 0;
    }
  }
  if (blocoAtual.length > 0) {
    lotes.push({ conteudo: blocoAtual.join('\n'), categoriaContexto: ultimaCategoria });
  }
  return lotes.length ? lotes : [{ conteudo: texto, categoriaContexto: '' }];
}

// ✅ PROCESSA UM LOTE INDIVIDUAL
async function processarUmLote(model, loteTexto, contexto) {
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

  try {
    return JSON.parse(texto);
  } catch {
    if (!texto.endsWith('}')) texto = texto.replace(/,\s*$/, '') + '}]}';
    return JSON.parse(texto);
  }
}

// ✅ JUNTA PRODUTOS DE VÁRIAS CATEGORIAS
function extrairProdutos(dadosLote) {
  const produtos = [];
  for (const cat of dadosLote.categorias || []) {
    for (const p of cat.produtos || []) {
      produtos.push({ ...p, _categoria: cat.nomeCategoria });
    }
  }
  return produtos;
}

// 🔌 ROTA 1: INICIAR NOVA SESSÃO DE PROCESSAMENTO
app.post('/api/produtos/processar-iniciar', async (req, res) => {
  try {
    const { listaBruta } = req.body;
    if (!listaBruta || listaBruta.trim().length === 0) {
      return res.status(400).json({ sucesso: false, erro: 'Lista vazia' });
    }

    const lotesDados = dividirListaEmLotes(listaBruta);
    
    // Cria sessão no banco
    const sessao = await SessaoProcessamento.create({
      status: 'iniciada',
      listaBruta,
      totalLotes: lotesDados.length,
      lotes: lotesDados.map((_, i) => ({ indice: i, status: 'pendente' })),
      produtos: [],
      atualizadaEm: Date.now()
    });

    console.log(`🆕 Sessão ${sessao._id} criada com ${lotesDados.length} lotes`);

    res.json({
      sucesso: true,
      sessaoId: sessao._id,
      totalLotes: lotesDados.length
    });

  } catch (erro) {
    console.error('❌ Erro ao criar sessão:', erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔌 ROTA 2: PROCESSAR PRÓXIMO LOTE PENDENTE
app.post('/api/produtos/processar-proximo/:sessaoId', async (req, res) => {
  try {
    const { sessaoId } = req.params;
    let sessao = await SessaoProcessamento.findById(sessaoId);
    
    if (!sessao) {
      return res.status(404).json({ sucesso: false, erro: 'Sessão não encontrada' });
    }

    // Encontra próximo lote pendente
    const loteIndex = sessao.lotes.findIndex(l => l.status === 'pendente');
    
    if (loteIndex === -1) {
      // Todos processados!
      sessao.status = sessao.lotes.some(l => l.status === 'falhou') ? 'parcial' : 'concluida';
      sessao.atualizadaEm = Date.now();
      await sessao.save();
      
      return res.json({
        sucesso: true,
        concluido: true,
        sessao: {
          status: sessao.status,
          totalLotes: sessao.totalLotes,
          lotesConcluidos: sessao.lotesConcluidos,
          lotesFalhos: sessao.lotesFalhos,
          totalProdutos: sessao.totalProdutos
        },
        produtos: sessao.produtos
      });
    }

    const lote = sessao.lotes[loteIndex];
    const lotesDados = dividirListaEmLotes(sessao.listaBruta);
    const dadosLote = lotesDados[loteIndex];

    // Marca como processando
    lote.status = 'processando';
    lote.iniciadoEm = Date.now();
    lote.tentativas += 1;
    sessao.status = 'processando';
    sessao.atualizadaEm = Date.now();
    await sessao.save();

    console.log(`🔄 Sessão ${sessaoId} | Lote ${loteIndex + 1}/${sessao.totalLotes}`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: CONFIG.TEMPERATURA,
        maxOutputTokens: CONFIG.MAX_TOKENS
      }
    });

    try {
      const resultado = await processarUmLote(model, dadosLote.conteudo, dadosLote.categoriaContexto);
      const produtosNovos = extrairProdutos(resultado);

      // Salva lote como concluído
      lote.status = 'concluido';
      lote.concluidoEm = Date.now();
      lote.produtos = produtosNovos;
      sessao.lotesConcluidos += 1;
      sessao.totalProdutos += produtosNovos.length;
      sessao.produtos.push(...produtosNovos);
      sessao.atualizadaEm = Date.now();

      // Verifica se acabou
      const temPendentes = sessao.lotes.some(l => l.status === 'pendente');
      const temFalhos = sessao.lotes.some(l => l.status === 'falhou');
      
      if (!temPendentes && !temFalhos) {
        sessao.status = 'concluida';
      } else if (!temPendentes && temFalhos) {
        sessao.status = 'parcial';
      }

      await sessao.save();

      console.log(`✅ Lote ${loteIndex + 1} OK | +${produtosNovos.length} produtos | Total: ${sessao.totalProdutos}`);

      res.json({
        sucesso: true,
        concluido: false,
        loteProcessado: loteIndex + 1,
        produtosNovos: produtosNovos.length,
        sessao: {
          status: sessao.status,
          totalLotes: sessao.totalLotes,
          lotesConcluidos: sessao.lotesConcluidos,
          lotesFalhos: sessao.lotesFalhos,
          totalProdutos: sessao.totalProdutos
        }
      });

    } catch (erroLote) {
      lote.status = lote.tentativas >= CONFIG.MAX_TENTATIVAS ? 'falhou' : 'pendente';
      lote.erro = erroLote.message;
      
      if (lote.status === 'falhou') {
        sessao.lotesFalhos += 1;
      }
      
      sessao.atualizadaEm = Date.now();
      
      const temPendentes = sessao.lotes.some(l => l.status === 'pendente');
      const temFalhos = sessao.lotes.some(l => l.status === 'falhou');
      
      if (!temPendentes && !temFalhos) {
        sessao.status = 'concluida';
      } else if (!temPendentes && temFalhos) {
        sessao.status = 'parcial';
      }

      await sessao.save();

      console.log(`❌ Lote ${loteIndex + 1} FALHOU: ${erroLote.message} | Tentativa ${lote.tentativas}/${CONFIG.MAX_TENTATIVAS}`);

      res.json({
        sucesso: lote.status === 'pendente', // Se vai tentar de novo, ainda é sucesso
        concluido: false,
        loteProcessado: loteIndex + 1,
        tentouNovamente: lote.status === 'pendente',
        erro: erroLote.message,
        sessao: {
          status: sessao.status,
          totalLotes: sessao.totalLotes,
          lotesConcluidos: sessao.lotesConcluidos,
          lotesFalhos: sessao.lotesFalhos,
          totalProdutos: sessao.totalProdutos
        }
      });
    }

  } catch (erro) {
    console.error('❌ Erro:', erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔌 ROTA 3: VER STATUS DA SESSÃO
app.get('/api/produtos/processar-status/:sessaoId', async (req, res) => {
  try {
    const sessao = await SessaoProcessamento.findById(req.params.sessaoId);
    if (!sessao) {
      return res.status(404).json({ sucesso: false, erro: 'Sessão não encontrada' });
    }

    res.json({
      sucesso: true,
      sessao: {
        _id: sessao._id,
        status: sessao.status,
        totalLotes: sessao.totalLotes,
        lotesConcluidos: sessao.lotesConcluidos,
        lotesFalhos: sessao.lotesFalhos,
        totalProdutos: sessao.totalProdutos,
        criadaEm: sessao.criadaEm,
        atualizadaEm: sessao.atualizadaEm,
        lotes: sessao.lotes.map(l => ({
          indice: l.indice,
          status: l.status,
          tentativas: l.tentativas,
          erro: l.erro
        }))
      },
      produtos: sessao.produtos
    });

  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔌 ROTA 4: RETENTAR LOTES FALHOS
app.post('/api/produtos/processar-retentar/:sessaoId', async (req, res) => {
  try {
    const sessao = await SessaoProcessamento.findById(req.params.sessaoId);
    if (!sessao) {
      return res.status(404).json({ sucesso: false, erro: 'Sessão não encontrada' });
    }

    // Volta lotes falhos para pendente
    let retentados = 0;
    sessao.lotes.forEach(l => {
      if (l.status === 'falhou') {
        l.status = 'pendente';
        l.erro = undefined;
        retentados++;
      }
    });

    sessao.lotesFalhos = 0;
    sessao.status = 'processando';
    sessao.atualizadaEm = Date.now();
    await sessao.save();

    res.json({
      sucesso: true,
      mensagem: `${retentados} lote(s) marcados para nova tentativa`,
      sessaoId: sessao._id
    });

  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🛣️ Outras rotas
app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/ml', mlRoutes);

app.get('/api', (req, res) => {
  res.json({
    mensagem: 'API da Loja rodando! 🚀',
    processador: {
      modelo: 'gemini-3.6-flash',
      tamanhoLote: CONFIG.TAMANHO_LOTE,
      timeout: `${CONFIG.TIMEOUT_POR_LOTE / 1000}s`,
      retentativas: CONFIG.MAX_TENTATIVAS
    }
  });
});

// 🔗 MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB CONECTADO'))
  .catch(err => console.log('❌ Erro MongoDB:', err.message));

// 🚀 Inicia
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor: http://localhost:${PORT}`);
  console.log(`🤖 Processador em lote com sessões ativado!`);
});