/**
 * Utilitário para buscar imagens de produtos
 * Utiliza múltiplas fontes (Bing, Google, DuckDuckGo)
 */

const https = require('https');
const http = require('http');

async function validarImagemUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const valor = url.trim();
  if (!valor || !/^https?:\/\//i.test(valor)) return false;

  return new Promise((resolve) => {
    const protocolo = valor.startsWith('https:') ? https : http;
    const req = protocolo.get(valor, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      const statusOk = res.statusCode >= 200 && res.statusCode < 400;
      const contentType = String(res.headers['content-type'] || '');
      const tipoImagem = contentType.includes('image/') || /\.(?:jpg|jpeg|png|webp|gif|avif|bmp|svg)(?:\?.*)?$/i.test(valor);
      res.resume();
      resolve(statusOk && tipoImagem);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Busca imagem via Bing Image Search (sem API key necessária)
 */
async function buscarImagemBing(nomeProduto) {
  return new Promise((resolve) => {
    try {
      const query = encodeURIComponent(nomeProduto.trim());
      const url = `https://www.bing.com/images/search?q=${query}&FORM=IQFRBA`;
      
      // Faz um request simples para obter a página
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
          if (data.length > 50000) {
            res.destroy(); // Para de receber dados
          }
        });

        res.on('end', () => {
          try {
            // O Bing pode retornar a imagem principal como murl ou thumburl.
            const matches = data.match(/"(?:murl|thumburl)":"([^"]+)"/g);
            if (matches && matches.length > 0) {
              const imageUrl = matches[0].match(/"(?:murl|thumburl)":"([^"]+)"/)[1]
                .replace(/\\u002f/g, '/')
                .replace(/\\u0026/g, '&');
              resolve(imageUrl);
              return;
            }
          } catch (e) {
            console.error('Erro ao parsear Bing:', e.message);
          }
          resolve(null);
        });
      }).on('error', () => resolve(null));
    } catch (err) {
      console.error('Erro ao buscar no Bing:', err.message);
      resolve(null);
    }
  });
}

/**
 * Busca imagem via Unsplash (requer API KEY)
 */
async function buscarImagemUnsplash(nomeProduto, apiKey) {
  return new Promise((resolve) => {
    if (!apiKey) {
      resolve(null);
      return;
    }

    try {
      const query = encodeURIComponent(nomeProduto.trim());
      const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&order_by=relevant`;
      
      https.get(url, {
        headers: { 'Authorization': `Client-ID ${apiKey}` }
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.results && json.results.length > 0) {
              resolve(json.results[0].urls.regular);
              return;
            }
          } catch (e) {
            console.error('Erro ao parsear Unsplash:', e.message);
          }
          resolve(null);
        });
      }).on('error', () => resolve(null));
    } catch (err) {
      console.error('Erro ao buscar no Unsplash:', err.message);
      resolve(null);
    }
  });
}

/**
 * Busca imagem via Pixabay (requer API KEY)
 */
async function buscarImagemPixabay(nomeProduto, apiKey) {
  return new Promise((resolve) => {
    if (!apiKey) {
      resolve(null);
      return;
    }

    try {
      const query = encodeURIComponent(nomeProduto.trim());
      const url = `https://pixabay.com/api/?key=${apiKey}&q=${query}&image_type=photo&order=popular&per_page=1`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.hits && json.hits.length > 0) {
              resolve(json.hits[0].webformatURL);
              return;
            }
          } catch (e) {
            console.error('Erro ao parsear Pixabay:', e.message);
          }
          resolve(null);
        });
      }).on('error', () => resolve(null));
    } catch (err) {
      console.error('Erro ao buscar no Pixabay:', err.message);
      resolve(null);
    }
  });
}

/**
 * Função principal de busca - tenta várias fontes
 */
async function buscarImagemProduto(nomeProduto, config = {}) {
  const { unsplashKey, pixabayKey, tentarBing = true } = config;
  const nome = String(nomeProduto || '').trim();
  if (!nome) return null;

  const buscas = [];

  if (unsplashKey) {
    buscas.push(() => buscarImagemUnsplash(nome, unsplashKey));
  }

  if (pixabayKey) {
    buscas.push(() => buscarImagemPixabay(nome, pixabayKey));
  }

  if (tentarBing) {
    buscas.push(() => buscarImagemBing(nome));
  }

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    for (const buscar of buscas) {
      try {
        const url = await buscar();
        if (url && await validarImagemUrl(url)) {
          return url;
        }
      } catch (err) {
        console.warn(`Falha ao buscar imagem na tentativa ${tentativa}:`, err.message);
      }
    }
  }

  return null;
}

module.exports = {
  buscarImagemProduto,
  buscarImagemUnsplash,
  buscarImagemPixabay,
  buscarImagemBing,
  validarImagemUrl
};
