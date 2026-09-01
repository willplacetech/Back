const mongoose = require('mongoose');
const axios = require('axios');
const Produto = require('../models/Produto');
require('dotenv').config();

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

const LISTA_IMAGENS = [
  { nome: 'iPhone 17 Pro Max 256GB Prata', preco: '6990.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 Pro Max 256GB Deep Blue', preco: '6900.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 Pro Max 256GB Cosmic Orange', preco: '7100.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 Pro 256GB Prata', preco: '6400.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 Pro 256GB Deep Blue', preco: '6380.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 Air 256GB Light Gold', preco: '5200.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 256GB Branco', preco: '4990.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 256GB Preto', preco: '4950.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17 256GB Verde Sage', preco: '4800.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17E 256GB Branco', preco: '3750.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17E 256GB Preto', preco: '3800.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 17E 256GB Rosa', preco: '3800.00', categoria: 'iPhones Lacrados', imagem: 'https://store.apple.com/iphone' },
  { nome: 'iPhone 16 Plus 128GB Azul', preco: '4600.00', categoria: 'iPhones Lacrados', imagem: 'https://www.apple.com/iphone-16/' },
  { nome: 'iPhone 16 Plus 256GB Branco', preco: '5450.00', categoria: 'iPhones Lacrados', imagem: 'https://www.apple.com/iphone-16/' },
  { nome: 'iPhone 15 128GB Preto (Não ativado)', preco: '3550.00', categoria: 'iPhones Lacrados', imagem: 'https://www.apple.com/iphone-15/' },
  { nome: 'iPhone 15 128GB Azul (Não ativado)', preco: '3580.00', categoria: 'iPhones Lacrados', imagem: 'https://www.apple.com/iphone-15/' },
  { nome: 'iPhone 16 Pro Max 256GB CPO Desert Titanium', preco: '5900.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-16-pro/' },
  { nome: 'iPhone 16 Pro Max 256GB CPO Natural Titanium', preco: '5900.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-16-pro/' },
  { nome: 'iPhone 16 128GB CPO Branco', preco: '3990.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-16/' },
  { nome: 'iPhone 16 256GB CPO Branco', preco: '4100.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-16/' },
  { nome: 'iPhone 16 256GB CPO Preto', preco: '4080.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-16/' },
  { nome: 'iPhone 15 Pro Max 256GB CPO Preto', preco: '4800.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-15-pro/' },
  { nome: 'iPhone 14 Plus 128GB CPO Meia-Noite', preco: '3130.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-14/' },
  { nome: 'iPhone 14 512GB CPO Branco', preco: '3490.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-14/' },
  { nome: 'iPhone 13 128GB CPO Branco', preco: '2850.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-13/' },
  { nome: 'iPhone 13 256GB CPO Branco', preco: '3100.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-13/' },
  { nome: 'iPhone 13 256GB CPO Preto', preco: '3050.00', categoria: 'iPhones CPO', imagem: 'https://www.apple.com/iphone-13/' },
  { nome: 'Apple Watch Ultra 3 2024 Preto', preco: '4500.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-ultra/' },
  { nome: 'Apple Watch Ultra 3 2024 Natural Titanium', preco: '4700.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-ultra/' },
  { nome: 'Apple Watch Series 11 42mm Prata', preco: '2030.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 42mm Preto Jateado', preco: '2030.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 42mm Rosa', preco: '2000.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 42mm Cinza Espacial', preco: '1990.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 46mm Prata', preco: '2200.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 46mm Preto', preco: '2200.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 46mm Rosa', preco: '2190.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 11 46mm Cinza Espacial', preco: '2190.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-11/' },
  { nome: 'Apple Watch Series 9 45mm Preto', preco: '1750.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-series-9/' },
  { nome: 'Apple Watch SE 3 40mm Meia-Noite', preco: '1500.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Apple Watch SE 3 40mm Luz Estelar', preco: '1550.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Apple Watch SE 3 40mm com Celular Meia-Noite', preco: '1820.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Apple Watch SE 3 44mm Meia-Noite', preco: '1650.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Apple Watch SE 2 44mm Preto (Pulseira Borracha)', preco: '1150.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Apple Watch SE 2 44mm com Celular Preto', preco: '1450.00', categoria: 'Apple Watch', imagem: 'https://www.apple.com/apple-watch-se/' },
  { nome: 'Garmin Forerunner 170 Branco', preco: '1720.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 170 Preto', preco: '1690.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 165 Branco', preco: '1350.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 165 Preto', preco: '1330.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Vivoactive 5 Preto', preco: '1350.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Vivoactive 5 Ouro Lunar', preco: '1400.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Vivoactive 6 Preto', preco: '1690.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 570 Branco/Turquesa', preco: '2750.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 570 Cinza Ardósia', preco: '2750.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 965 Branco', preco: '2990.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 965 Preto', preco: '2990.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 970 Branco', preco: '3990.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Garmin Forerunner 970 Preto', preco: '4090.00', categoria: 'Garmin', imagem: 'https://www.garmin.com/pt-BR/' },
  { nome: 'Google Fitbit Air Preto', preco: '920.00', categoria: 'Fitbit', imagem: 'https://store.google.com/br/category/ watches/' },
  { nome: 'Google Fitbit Air Edição Stephen Curry', preco: '1150.00', categoria: 'Fitbit', imagem: 'https://store.google.com/br/category/watches/' },
  { nome: 'iPad 11ª geração 128GB Wi-Fi Prata', preco: '2700.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 128GB Wi-Fi Azul', preco: '2650.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 128GB Wi-Fi Amarelo', preco: '2600.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 128GB Wi-Fi Rosa', preco: '2650.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 128GB Wi-Fi + Celular Prata', preco: '4300.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 256GB Wi-Fi Prata', preco: '3500.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 256GB Wi-Fi Rosa', preco: '3500.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad 11ª geração 256GB Wi-Fi + Celular Prata', preco: '5200.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad/' },
  { nome: 'iPad mini 6ª geração 256GB Luz Estelar', preco: '3600.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-mini/' },
  { nome: 'iPad mini 7ª geração A17 Pro 128GB Roxo', preco: '3990.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-mini/' },
  { nome: 'iPad mini 7ª geração A17 Pro 128GB Cinza Espacial', preco: '3990.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-mini/' },
  { nome: 'iPad Air M4 11 polegadas 1TB Wi-Fi Roxo', preco: '7990.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air M4 13 polegadas 128GB Wi-Fi Luz Estelar', preco: '6200.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air M4 13 polegadas 128GB Wi-Fi Cinza Espacial', preco: '6000.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air M4 13 polegadas 256GB Wi-Fi Luz Estelar', preco: '6700.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air M3 11 polegadas 128GB Azul', preco: '4450.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air 7ª geração M3 13 polegadas 128GB Azul', preco: '5400.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air 7ª geração M3 13 polegadas 128GB Luz Estelar', preco: '5600.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air 7ª geração M3 13 polegadas 128GB Roxo', preco: '5400.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Air 7ª geração M3 13 polegadas 128GB Cinza Espacial', preco: '5600.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-air/' },
  { nome: 'iPad Pro M5 11 polegadas 256GB Prata', preco: '7300.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro M5 11 polegadas 256GB Cinza Espacial', preco: '7250.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro M5 13 polegadas 256GB Prata', preco: '8100.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro M5 13 polegadas 256GB Cinza Espacial', preco: '8100.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro M5 13 polegadas 512GB Cinza Espacial', preco: '9100.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro 7ª geração M4 13 polegadas 256GB Prata', preco: '8200.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'iPad Pro 7ª geração M4 13 polegadas 256GB Preto', preco: '8150.00', categoria: 'iPads', imagem: 'https://www.apple.com/ipad-pro/' },
  { nome: 'MacBook Neo CPO 8GB/512GB Prata', preco: '4600.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo CPO 8GB/512GB Azul Índigo', preco: '4600.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo CPO 8GB/512GB Rosa', preco: '4700.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/256GB 13 polegadas Prata', preco: '4700.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/256GB 13 polegadas Azul', preco: '4500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/256GB 13 polegadas Rosa', preco: '4500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/512GB 13 polegadas Prata (Touch ID)', preco: '5230.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/512GB 13 polegadas Azul', preco: '5200.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/512GB 13 polegadas Verde', preco: '5200.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Neo 8GB/512GB 13 polegadas Rosa', preco: '5250.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Pro M5 16GB/512GB 14 polegadas Preto', preco: '11650.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 16GB/1TB 14 polegadas Prata', preco: '12000.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 16GB/1TB 14 polegadas Preto', preco: '11800.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 24GB/1TB 14 polegadas Prata', preco: '13850.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 24GB/1TB 14 polegadas Preto', preco: '13600.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 Pro 48GB/1TB 16 polegadas Preto', preco: '23700.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 Max 36GB/2TB 16 polegadas Preto', preco: '25900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M5 Max 48GB/2TB 16 polegadas Preto', preco: '31000.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Air M5 16GB/512GB 13 polegadas Prata', preco: '8300.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 13 polegadas Meia-Noite', preco: '8100.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 13 polegadas Azul Céu', preco: '8050.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 13 polegadas Luz Estelar', preco: '8050.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/1TB 13 polegadas Prata', preco: '9000.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/1TB 13 polegadas Meia-Noite', preco: '9000.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/1TB 13 polegadas Azul Céu', preco: '8900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/1TB 13 polegadas Luz Estelar', preco: '8900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 24GB/1TB 13 polegadas Meia-Noite', preco: '11900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 24GB/1TB 13 polegadas Luz Estelar', preco: '11900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 15 polegadas Prata', preco: '9400.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 15 polegadas Preto', preco: '9450.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 15 polegadas Luz Estelar', preco: '9200.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 16GB/512GB 15 polegadas Azul Céu', preco: '9200.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 24GB/1TB 15 polegadas Prata', preco: '12990.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M5 24GB/1TB 15 polegadas Meia-Noite', preco: '12950.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Pro M4 16GB/512GB 14 polegadas Preto', preco: '11300.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M4 Pro 24GB/512GB 14 polegadas Prata', preco: '13100.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M4 Pro 24GB/512GB 14 polegadas Preto', preco: '13100.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M4 Pro 24GB/512GB 16 polegadas Prata', preco: '15500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M4 Pro 24GB/512GB 16 polegadas Preto', preco: '15500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'MacBook Pro M4 Max 48GB/1TB 16 polegadas Prata', preco: '24500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-pro/' },
  { nome: 'Mac mini M4 16GB/256GB Prata', preco: '4990.00', categoria: 'MacDesktops', imagem: 'https://www.apple.com/mac-mini/' },
  { nome: 'Mac mini M4 16GB/512GB Prata', preco: '5550.00', categoria: 'MacDesktops', imagem: 'https://www.apple.com/mac-mini/' },
  { nome: 'MacBook Air M4 24GB/512GB 15 polegadas Luz Estelar', preco: '10700.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 24GB/512GB 15 polegadas Azul Céu', preco: '10700.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 16GB/256GB 15 polegadas Meia-Noite', preco: '8100.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 16GB/256GB 15 polegadas Luz Estelar', preco: '8000.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 16GB/256GB 15 polegadas Azul Céu', preco: '7900.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 16GB/512GB 13 polegadas Prata', preco: '7950.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'MacBook Air M4 16GB/512GB 15 polegadas Meia-Noite', preco: '8350.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air/' },
  { nome: 'Mac mini M2 8GB/512GB Prata', preco: '3650.00', categoria: 'MacDesktops', imagem: 'https://www.apple.com/mac-mini/' },
  { nome: 'MacBook Air M2 24GB/512GB 13 polegadas Preto (Sem lacre)', preco: '6500.00', categoria: 'MacBooks', imagem: 'https://www.apple.com/macbook-air-m2/' },
  { nome: 'AirPods Max 2ª geração (USB-C) 2026 Meia-Noite', preco: '3100.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-max/' },
  { nome: 'AirPods Max 2ª geração (USB-C) 2026 Luz Estelar', preco: '3130.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-max/' },
  { nome: 'AirPods Max (USB-C) 2024 Meia-Noite', preco: '2900.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-max/' },
  { nome: 'AirPods Max (USB-C) 2024 Luz Estelar', preco: '3100.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-max/' },
  { nome: 'AirPods 4ª geração', preco: '710.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-4/' },
  { nome: 'AirPods 4ª geração com Cancelamento de Ruído', preco: '1070.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-4/' },
  { nome: 'AirPods Pro 3ª geração', preco: '1320.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airpods-pro/' },
  { nome: 'Magic Trackpad Branco', preco: '1200.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-accessories/' },
  { nome: 'Magic Trackpad Preto', preco: '1250.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-accessories/' },
  { nome: 'Magic Mouse 2 Branco', preco: '490.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-mouse/' },
  { nome: 'Magic Mouse 2 Preto', preco: '600.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-mouse/' },
  { nome: 'Magic Mouse 3 (USB-C) Branco', preco: '500.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-mouse/' },
  { nome: 'Magic Mouse 3 (USB-C) Preto', preco: '600.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-mouse/' },
  { nome: 'Magic Keyboard com Teclado Numérico e Touch ID Branco', preco: '1400.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/magic-keyboard/' },
  { nome: 'Teclado para iPad Air (M3/M4) 13 polegadas Branco', preco: '2500.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/ipad-keyboards/' },
  { nome: 'Teclado para iPad Pro M4/M5 11 polegadas Preto', preco: '2400.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/ipad-keyboards/' },
  { nome: 'AirTag Kit com 4 Unidades', preco: '550.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/airtag/' },
  { nome: 'Apple Pencil Pro', preco: '710.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/apple-pencil/' },
  { nome: 'Apple Pencil (USB-C)', preco: '520.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/apple-pencil/' },
  { nome: 'Apple Pencil 1ª geração com Adaptador', preco: '650.00', categoria: 'Acessórios', imagem: 'https://www.apple.com/apple-pencil/' }
];

async function atualizarProdutos() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'catalogo' });
    console.log('✅ Conectado ao MongoDB (catalogo)');

    let atualizados = 0;
    let ignorados = 0;
    let naoEncontrados = 0;

    for (const item of LISTA_IMAGENS) {
      const nome = String(item.nome || '').trim();
      const url = String(item.imagem || '').trim();

      if (!nome || !url) {
        ignorados += 1;
        console.log(`⚠️ Ignorado: ${nome || 'sem nome'} -> ${url || 'sem imagem'}`);
        continue;
      }

      const produto = await Produto.findOne({
        nome: { $regex: new RegExp('^' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });

      if (!produto) {
        naoEncontrados += 1;
        console.log(`❌ Produto não encontrado: ${nome}`);
        continue;
      }

      const imagemValida = await resolverImagemDireta(url);
      if (!imagemValida) {
        ignorados += 1;
        console.log(`⚠️ Imagem inválida para: ${produto.nome} (${url})`);
        continue;
      }

      produto.imagem = imagemValida;
      await produto.save();
      atualizados += 1;
      console.log(`✅ Atualizado: ${produto.nome} -> ${imagemValida}`);
    }

    console.log('\n📊 Resumo final');
    console.log(`Atualizados: ${atualizados}`);
    console.log(`Ignorados (URL inválida): ${ignorados}`);
    console.log(`Não encontrados: ${naoEncontrados}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao atualizar imagens:', error);
    process.exit(1);
  }
}

module.exports = { LISTA_IMAGENS, atualizarProdutos };

if (require.main === module) {
  atualizarProdutos();
}
