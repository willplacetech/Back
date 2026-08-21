const express = require('express');
const router = express.Router();
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const Produto = require('../models/Produto');
const { requireAuth } = require('../middleware/auth');

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
// 🔍 REMOVIDA BUSCA POR TERMO (todas APIs bloqueiam)
// ==========================================
router.get('/buscar', async (req, res) => {
  // Retorna vazio - agora usamos "Colar Link" ou cadastro manual
  return res.json([]);
});

// ==========================================
// 🔗 EXTRAIR DADOS DE QUALQUER LINK (FUNCIONA SEMPRE)
// Usa 3 métodos diferentes em cascata
// ==========================================
router.post('/extrair-link', async (req, res) => {
  try {
    const { url } = req.body;
    const destino = await validarUrlPublica(url);
    if (!destino) {
      return res.status(400).json({ error: '❌ Cole um link válido (começa com http:// ou https://)' });
    }

    const urlSegura = destino.toString();
    console.log(`\n🔗 Extraindo dados de: ${urlSegura}`);

    // MÉTODO 1: Tentar extrair DIRETO da página
    try {
      const resp = await axios.get(urlSegura, {
        headers: HEADERS, 
        timeout: 20000,
        maxRedirects: 5
      });
      
      const dados = extrairDoHTML(resp.data, urlSegura);
      if (dados && dados.nome && dados.nome !== 'Produto') {
        console.log('✅ Método 1 (direto) funcionou!');
        return res.json(dados);
      }
    } catch (e) {
      console.log('⚠️ Método 1 falhou:', e.message);
    }

    // MÉTODO 2: Usar proxy público AllOrigins
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlSegura)}`;
      const resp = await axios.get(proxyUrl, { headers: HEADERS, timeout: 25000 });
      const dados = extrairDoHTML(resp.data, urlSegura);
      if (dados && dados.nome && dados.nome !== 'Produto') {
        console.log('✅ Método 2 (proxy AllOrigins) funcionou!');
        return res.json(dados);
      }
    } catch (e) {
      console.log('⚠️ Método 2 falhou:', e.message);
    }

    // MÉTODO 3: Usar API pública de Open Graph (último recurso)
    try {
      const ogUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent(urlSegura)}`;
      const resp = await axios.get(ogUrl, { timeout: 20000 });
      const og = resp.data?.hybridGraph || resp.data?.openGraph || {};
      if (og.title || og.image) {
        const dados = {
          mlId: `LINK_${Date.now()}`,
          nome: og.title || 'Produto',
          preco: 0,
          imagem: (og.image || '').replace('http://', 'https://'),
          galeria: [(og.image || '').replace('http://', 'https://')].filter(Boolean),
          linkML: urlSegura,
          descricao: og.description || ''
        };
        console.log('✅ Método 3 (opengraph.io) funcionou!');
        return res.json(dados);
      }
    } catch (e) {
      console.log('⚠️ Método 3 falhou:', e.message);
    }

    // SE TODOS FALHAREM: retorna o que temos para o usuário completar manualmente
    console.log('ℹ️ Retornando dados básicos para completar manualmente');
    return res.json({
      mlId: `LINK_${Date.now()}`,
      nome: '',
      preco: 0,
      imagem: '',
      galeria: [],
      linkML: urlSegura,
      descricao: ''
    });

  } catch (err) {
    console.error('💥 ERRO GERAL:', err.message);
    return res.status(500).json({ 
      error: 'Não consegui extrair automaticamente. Cadastre manualmente abaixo!' 
    });
  }
});

// ==========================================
// 📄 Descrição (mantida para compatibilidade)
// ==========================================
router.get('/descricao/:id', (req, res) => {
  res.json({ texto: '' });
});

// ==========================================
// 💾 SALVAR NO BANCO (IGUAL ANTES)
// ==========================================
router.post('/importar', requireAuth, async (req, res) => {
  try {
    const { mlId, nome, preco, imagem, galeria, linkML, categoria, descricao } = req.body;
    
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: '❌ Preencha o NOME do produto' });
    }
    if (!preco || Number(preco) <= 0) {
      return res.status(400).json({ error: '❌ Preencha o PREÇO do produto' });
    }

    const idFinal = mlId || `MANUAL_${Date.now()}`;
    const existe = await Produto.findOne({ mlId: idFinal });
    if (existe) return res.status(400).json({ error: '⚠️ Produto já importado!' });

    const prod = await Produto.create({
      mlId: idFinal,
      nome: nome.trim(),
      preco: Number(preco),
      imagem: imagem || '',
      galeria: galeria || [],
      linkML: linkML || '',
      categoria: categoria || '',
      descricao: descricao || ''
    });
    
    console.log(`💾 ✅ PRODUTO SALVO: ${prod.nome} - R$ ${prod.preco.toFixed(2)}`);
    res.status(201).json(prod);
  } catch (err) {
    console.error('❌ Erro salvar:', err.message);
    res.status(500).json({ error: 'Erro ao salvar: ' + err.message });
  }
});

// ==========================================
// 🔧 FUNÇÃO INTERNA: extrai dados do HTML
// ==========================================
function extrairDoHTML(html, urlOriginal) {
  try {
    // Extrai meta tags Open Graph (funciona em 99% dos sites)
    const pega = (regex) => {
      const m = html.match(regex);
      return m ? m[1].trim() : '';
    };

    const nome = 
      pega(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i) ||
      pega(/<meta[^>]+name="twitter:title"[^>]+content="([^"]*)"/i) ||
      pega(/<title[^>]*>([^<]*)<\/title>/i) ||
      '';

    const imagem = 
      pega(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i) ||
      pega(/<meta[^>]+name="twitter:image"[^>]+content="([^"]*)"/i) ||
      '';

    const descricao = 
      pega(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ||
      pega(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ||
      '';

    // Extrai TODOS os preços em Real da página e pega o MENOR (geralmente é o correto)
    const regexPreco = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    const matches = [...html.matchAll(regexPreco)];
    let preco = 0;
    
    if (matches.length > 0) {
      const valores = matches
        .map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
        .filter(v => v > 0);
      if (valores.length > 0) {
        // Tenta pegar o segundo menor (muitas vezes o primeiro é o preço de avista/parcelado)
        const ordenados = [...valores].sort((a, b) => a - b);
        preco = ordenados.length >= 2 ? ordenados[1] : ordenados[0];
      }
    }

    // Tenta preço em formato americano (ex: 1299.90)
    if (preco === 0) {
      const re2 = /["']price["']\s*:\s*"?(\d+\.?\d*)"?/g;
      const m2 = [...html.matchAll(re2)];
      if (m2.length > 0) {
        const vals = m2.map(m => parseFloat(m[1])).filter(v => v > 1);
        if (vals.length > 0) preco = vals[0];
      }
    }

    return {
      mlId: `LINK_${Date.now()}`,
      nome: nome.substring(0, 180),
      preco: preco,
      imagem: imagem.replace('http://', 'https://'),
      galeria: [imagem.replace('http://', 'https://')].filter(Boolean),
      linkML: urlOriginal,
      descricao: descricao.substring(0, 600)
    };
  } catch (e) {
    console.error('Erro no parser HTML:', e.message);
    return null;
  }
}

module.exports = router;