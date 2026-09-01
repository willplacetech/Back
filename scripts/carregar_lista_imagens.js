const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const Produto = require('../models/Produto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function resolverImagemDireta(url) {
  if (!url || typeof url !== 'string') return '';

  const texto = url.trim();
  if (!texto) return '';

  if (/\.(jpe?g|png|webp|gif|avif|bmp)(\?.*)?$/i.test(texto)) {
    return texto;
  }

  try {
    const resposta = await axios.get(texto, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
      validateStatus: () => true,
      maxRedirects: 10
    });

    const html = typeof resposta.data === 'string' ? resposta.data : '';
    const padraoMeta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const padraoJson = html.match(/"(?:og:image|twitter:image)"\s*:\s*"([^"]+)"/i);
    const imagem = (padraoMeta ? padraoMeta[1] : padraoJson ? padraoJson[1] : '').trim();

    if (!imagem) return '';

    const urlFinal = imagem.startsWith('//') ? `https:${imagem}` : imagem.startsWith('/') ? new URL(imagem, texto).toString() : imagem;

    const cabecalho = await axios.head(urlFinal, {
      timeout: 8000,
      validateStatus: () => true,
      maxRedirects: 10
    });

    const contentType = (cabecalho.headers && cabecalho.headers['content-type']) || '';
    if (contentType.includes('image') || /\.(jpe?g|png|webp|gif|avif|bmp)(\?.*)?$/i.test(urlFinal)) {
      return urlFinal;
    }
  } catch (error) {
    // ignora e continua sem imagem
  }

  return '';
}

const LISTA_IMAGENS = require('./lista_imagens_diretas.json');

async function atualizarProdutos() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI não encontrada no .env do backend.');
    }

    await mongoose.connect(mongoUri, { dbName: 'catalogo' });
    console.log('? Conectado ao MongoDB (catalogo)');

    let atualizados = 0;
    let ignorados = 0;
    let naoEncontrados = 0;

    for (const item of LISTA_IMAGENS) {
      const nome = String(item.nome || '').trim();
      const url = String(item.imagem || '').trim();

      if (!nome || !url) {
        ignorados += 1;
        console.log(`?? Ignorado: ${nome || 'sem nome'} -> ${url || 'sem imagem'}`);
        continue;
      }

      const produto = await Produto.findOne({
        nome: { $regex: new RegExp('^' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });

      if (!produto) {
        naoEncontrados += 1;
        console.log(`? Produto n�o encontrado: ${nome}`);
        continue;
      }

      const imagemValida = await resolverImagemDireta(url);
      const imagemFinal = imagemValida || url;

      produto.imagem = imagemFinal;
      await produto.save();
      atualizados += 1;
      console.log(`? Atualizado: ${produto.nome} -> ${imagemFinal}`);
    }

    console.log('\n?? Resumo final');
    console.log(`Atualizados: ${atualizados}`);
    console.log(`Ignorados (URL inv�lida): ${ignorados}`);
    console.log(`N�o encontrados: ${naoEncontrados}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('? Erro ao atualizar imagens:', error);
    process.exit(1);
  }
}

module.exports = { LISTA_IMAGENS, atualizarProdutos };

if (require.main === module) {
  atualizarProdutos();
}
