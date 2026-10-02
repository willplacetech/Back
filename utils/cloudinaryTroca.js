const crypto = require('crypto');
const { CAMPOS_FOTOS } = require('../middleware/uploadTroca');

function configuracao() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    throw Object.assign(new Error('Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no backend'), { status: 503 });
  }
  return { cloudName, apiKey, apiSecret };
}

function assinar(parametros, apiSecret) {
  const serializado = Object.keys(parametros).sort().map(chave => `${chave}=${parametros[chave]}`).join('&');
  return crypto.createHash('sha256').update(serializado + apiSecret).digest('hex');
}

async function enviar(acao, parametros, config, arquivo) {
  const dados = new FormData();
  const assinados = { ...parametros, timestamp: Math.floor(Date.now() / 1000) };
  for (const [chave, valor] of Object.entries(assinados)) dados.append(chave, String(valor));
  dados.append('api_key', config.apiKey);
  dados.append('signature', assinar(assinados, config.apiSecret));
  if (arquivo) dados.append('file', new Blob([arquivo.buffer], { type: arquivo.mimetype }), 'foto');
  try {
    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/${acao}`, {
      method: 'POST', body: dados, signal: AbortSignal.timeout(30000), redirect: 'error'
    });
    if (!resposta.ok) throw new Error('Cloudinary não aceitou a operação');
    return await resposta.json();
  } catch {
    // Nunca encaminha respostas externas que possam revelar configuração/segredos.
    throw Object.assign(new Error('Não foi possível processar as fotos no Cloudinary. Tente novamente.'), { status: 502 });
  }
}

async function excluirFotos(assets, config = configuracao()) {
  const resultados = await Promise.allSettled(assets.map(async asset => {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const resposta = await enviar('destroy', { public_id: asset.publicId, invalidate: true }, config);
        if (['ok', 'not found'].includes(resposta.result)) return;
      } catch { /* tenta novamente sem expor a resposta do provedor */ }
    }
    throw new Error(asset.publicId);
  }));
  const falhas = resultados.flatMap((r, indice) => r.status === 'rejected' ? [assets[indice].publicId] : []);
  if (falhas.length) console.error('Não foi possível remover fotos órfãs da Troca no Cloudinary:', falhas);
  return falhas;
}

async function subirFotos(files, id) {
  const config = configuracao();
  const assets = CAMPOS_FOTOS.map(campo => ({ campo, publicId: `placetech/troca/${id}/${campo}-${crypto.randomBytes(8).toString('hex')}` }));
  const resultados = await Promise.allSettled(assets.map(async asset => {
    const resposta = await enviar('upload', {
      public_id: asset.publicId, overwrite: false, allowed_formats: 'jpg,jpeg,png,webp'
    }, config, files[asset.campo][0]);
    let url;
    try { url = new URL(resposta.secure_url); } catch { /* resposta incompleta */ }
    if (!url || url.protocol !== 'https:' || resposta.public_id !== asset.publicId || resposta.resource_type !== 'image') {
      throw Object.assign(new Error('Resposta de upload inválida do Cloudinary'), { status: 502 });
    }
    return { campo: asset.campo, url: url.toString() };
  }));
  const erro = resultados.find(r => r.status === 'rejected');
  if (erro) {
    // Inclui tentativas cuja resposta se perdeu, usando os IDs gerados previamente.
    await excluirFotos(assets, config);
    throw erro.reason;
  }
  return { fotos: Object.fromEntries(resultados.map(r => [r.value.campo, r.value.url])), assets };
}

module.exports = { configuracao, assinar, subirFotos, excluirFotos };
