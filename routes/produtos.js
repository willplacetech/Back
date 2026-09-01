const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const Produto = require('../models/Produto');
const { buscarImagemProduto } = require('../utils/imagemSearch');

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const partes = ip.split('.').map(Number);
    return partes[0] === 10 || partes[0] === 127 ||
      (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) ||
      (partes[0] === 192 && partes[1] === 168) ||
      partes[0] === 0;
  }
  return net.isIPv6(ip) && (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:'));
}

async function validarUrlPublica(valor) {
  try {
    const destino = new URL(valor);
    if (!['http:', 'https:'].includes(destino.protocol)) return null;
    if (destino.username || destino.password) return null;
    if (ipPrivado(destino.hostname)) return null;
    const enderecos = await dns.lookup(destino.hostname, { all: true });
    if (enderecos.some(({ address }) => ipPrivado(address))) return null;
    return destino;
  } catch {
    return null;
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3'
};

// ==========================================
// 🍎 IMPORTAR DO FORNECEDOR APPLE
// ==========================================
router.post('/importar-fornecedor', requireAuth, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || texto.trim() === '') {
      return res.status(400).json({ error: '❌ Cole a mensagem do fornecedor' });
    }

    const linhas = texto.split('\n').filter(l => l.trim().length > 0);
    const produtosDados = [];

    // Padrões para extrair nome e custo da mensagem do fornecedor
    const padraoNome = /(?:Produto|Nome|Item|Produto n[º°]?):\s*(.{3,180})/i;
    const padraoCusto = /(?:Custo|Preço de Custo|custo|valor custo):\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i;

    let atualNome = '';
    let atualCusto = 0;

    for (const linha of linhas) {
      const nomeMatch = linha.match(padraoNome);
      const custoMatch = linha.match(padraoCusto);

      if (nomeMatch) {
        // Salvar produto anterior se tiver dados
        if (atualNome && atualCusto > 0) {
          produtosDados.push({ nome: atualNome.trim(), custo: atualCusto });
        }
        atualNome = nomeMatch[1].trim();
        atualCusto = 0;
      }

      if (custoMatch) {
        let valorStr = custoMatch[1].replace(/\./g, '').replace(',', '.');
        atualCusto = Math.max(1, Number(valorStr));
      }
    }

    // Não esquecer do último produto
    if (atualNome && atualCusto > 0) {
      produtosDados.push({ nome: atualNome.trim(), custo: atualCusto });
    }

    if (produtosDados.length === 0) {
      return res.status(400).json({ error: '❌ Não foi possível extrair produtos e custos da mensagem' });
    }

    // Processar cada produto: buscar imagem e criar registro
    const resultados = [];

    for (const pd of produtosDados) {
      try {
        // Buscar imagem automatizada da web
        const imagem = await buscarImagemWeb(pd.nome);

        // Preço final: R$500 + 7% = R$535
        const precoFinal = 500 * 1.07; // 535

        const prod = await Produto.create({
          nome: pd.nome.substring(0, 180),
          preco: pd.custo, // preço de custo armazenado
          precoPersonalizado: precoFinal, // preço final de venda
          imagem: imagem || '',
          categoria: 'Apple',
          descricao: 'Importado do fornecedor Apple',
          disponivel: true
        });

        resultados.push({
          id: prod._id,
          nome: prod.nome,
          custo: prod.preco,
          precoFinal: prod.precoPersonalizado,
          imagem: prod.imagem
        });

      } catch (err) {
        console.error(`Erro ao processar produto ${pd.nome}:`, err.message);
        resultados.push({
          nome: pd.nome,
          error: err.message
        });
      }
    }

    res.json({
      sucesso: true,
      total: produtosDados.length,
      cadastrados: resultados.filter(r => !r.error),
      erros: resultados.filter(r => r.error)
    });

  } catch (err) {
    console.error('❌ Erro geral no importador de fornecedor:', err.message);
    res.status(500).json({ error: 'Erro ao processar importação: ' + err.message });
  }
});

// ==========================================
// 🔍 FUNÇÃO INTERNA: Buscar imagem da web
// ==========================================
async function buscarImagemWeb(nomeProduto) {
  try {
    const imagemAutomatica = await buscarImagemProduto(nomeProduto, {
      unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
      pixabayKey: process.env.PIXABAY_API_KEY,
      tentarBing: true
    });
    if (imagemAutomatica) return imagemAutomatica;

    // Estratégia 1: Tentar Open Graph.io API
    try {
      const ogUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent('https://www.google.com/search?q=' + encodeURIComponent(nomeProduto))}`;
      const resp = await axios.get(ogUrl, { timeout: 15000 });
      const og = resp.data?.hybridGraph || resp.data?.openGraph || {};
      if (og.image) {
        return og.image.replace('http://', 'https://');
      }
    } catch (e) {
      // Continuar para próxima estratégia
    }

    // Estratégia 2: Busca no Mercado Livre (já que a API existe)
    try {
      const mlSearch = `https://lista.mercadolivre.com.br/${encodeURIComponent(nomeProduto.replace(/\s+/g, '-'))}-c`;
      const resp = await axios.get(mlSearch, {
        headers: HEADERS,
        timeout: 20000,
        maxRedirects: 5
      });
      
      // Extrair primeira imagem dos resultados
      const imgMatch = resp.data.match(/<img[^>]+src="([^"]+)"[^>]*class="ui-pdp-image"|data-src="([^"]+)"/i);
      const imgSrc = (imgMatch && (imgMatch[1] || imgMatch[2])) 
        ? (imgMatch[1] || imgMatch[2]).replace('http://', 'https://') 
        : null;
      
      if (imgSrc && (imgSrc.includes('mlimg') || imgSrc.includes('imagens'))) {
        return imgSrc;
      }
    } catch (e) {
      // Continuar para próxima estratégia
    }

    // Estratégia 3: Usar Clearbit logo (se tiver domínio reconhecível)
    try {
      const dominio = nomeProduto.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'apple';
      const clearbitUrl = `https://logo.clearbit.com/${dominio}.com`;
      const resp = await axios.get(clearbitUrl, { timeout: 8000, maxRedirects: 3 });
      if (resp.status === 200) {
        return resp.request?.res?.redirectUrls?.[0] || clearbitUrl;
      }
    } catch (e) {
      // Continuar para fallback
    }

    // Fallback: return null para usar placeholder no frontend
    return null;

  } catch (err) {
    console.error('Erro ao buscar imagem:', err.message);
    return null;
  }
}

async function buscarDescricaoWeb(nomeProduto) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(`"${nomeProduto}"`)}`;
    const resposta = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const primeiroResultado = resposta.data.match(/<li class="b_algo"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!primeiroResultado) return '';

    const descricao = primeiroResultado[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    return descricao.length >= 30 ? descricao.substring(0, 600) : '';
  } catch (err) {
    console.error(`Não foi possível buscar descrição de ${nomeProduto}:`, err.message);
    return '';
  }
}

// ==========================================
// 📦 IMPORTAR PRODUTOS EM LOTE
// ==========================================
const produtoController = require('../controllers/produtoController');

router.post('/importar-lote', requireAuth, async (req, res) => {
  try {
    const { produtos } = req.body;
    const atualizarExistentes = req.body.atualizarExistentes !== false;

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ sucesso: false, error: 'Array de produtos é obrigatório' });
    }

    const resultados = {
      sucesso: [],
      erros: [],
      total: produtos.length
    };

    // Processa em lotes de 5 produtos paralelos
    const tamanhoLote = 5;
    for (let i = 0; i < produtos.length; i += tamanhoLote) {
      const lote = produtos.slice(i, i + tamanhoLote);
      
      await Promise.all(lote.map(async (p, idx) => {
        try {
          const preco = Number(p.preco);
          const precoPersonalizado = p.precoPersonalizado ? Number(p.precoPersonalizado) : undefined;

          // Validações
          if (!p.nome || !p.nome.trim() || !Number.isFinite(preco) || preco <= 0) {
            resultados.erros.push({
              indice: i + idx,
              nome: p.nome || 'Sem nome',
              erro: 'Nome e preço são obrigatórios'
            });
            return;
          }

          const nomeNormalizado = p.nome.trim();
          const existente = atualizarExistentes
            ? await Produto.findOne({ nome: { $regex: `^${nomeNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
            : null;
          const descricaoWeb = !p.descricao && (!existente || !existente.descricao)
            ? await buscarDescricaoWeb(nomeNormalizado)
            : '';

          // Busca imagem apenas para produto novo ou sem imagem cadastrada.
          let imagemUrl = p.imagem || existente?.imagem || '';
          if (!imagemUrl) {
            imagemUrl = await buscarImagemWeb(nomeNormalizado) || '';
          }

          const produto = existente
            ? await Produto.findByIdAndUpdate(existente._id, {
              preco,
              precoPersonalizado,
              categoria: p.categoria || existente.categoria,
              ...(descricaoWeb && !existente.descricao ? { descricao: descricaoWeb } : {}),
              ...(imagemUrl && !existente.imagem ? { imagem: imagemUrl } : {})
            }, { new: true, runValidators: true })
            : await Produto.create({
              nome: nomeNormalizado,
              descricao: p.descricao || descricaoWeb,
              preco,
              precoPersonalizado,
              categoria: p.categoria || 'Importado',
              imagem: imagemUrl,
              disponivel: p.disponivel !== false
            });

          resultados.sucesso.push({
            indice: i + idx,
            nome: produto.nome,
            id: produto._id,
            acao: existente ? 'atualizado' : 'adicionado'
          });

        } catch (err) {
          console.error(`Erro ao processar produto:`, err.message);
          resultados.erros.push({
            indice: i + idx,
            nome: p.nome || 'Sem nome',
            erro: err.message
          });
        }
      }));
    }

    res.status(201).json({
      sucesso: resultados.erros.length === 0,
      resultados,
      resumo: `${resultados.sucesso.length}/${resultados.total} produtos importados com sucesso`
    });

  } catch (err) {
    console.error("❌ Erro ao importar lote:", err.message);
    res.status(400).json({ sucesso: false, error: err.message });
  }
});

// Rotas CRUD: as rotas específicas devem ficar antes de /:id.
router.get('/', requireAuth, produtoController.listar);
router.get('/disponiveis', produtoController.listarDisponiveis);
router.get('/relatorio', requireAuth, produtoController.relatorio);
router.get('/categoria/:categoria', produtoController.buscarPorCategoria);
router.get('/:id', requireAuth, produtoController.buscarPorId);

router.post('/', requireAuth, produtoController.criar);
router.put('/:id', requireAuth, produtoController.atualizar);
router.delete('/:id', requireAuth, produtoController.excluir);

module.exports = router;