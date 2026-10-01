// Verificação local com Chrome e CDP nativo do Node, sem bibliotecas adicionais.
// Usa somente dados em memória e não carrega .env nem conecta ao MongoDB.
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const express = require('express');
const Produto = require('../models/Produto');
const Pedido = require('../models/Pedido');
const { planejarMigracao } = require('./migrar-variantes');
const { produtosMatriz } = require('../tests/fixtures/variantes');

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
async function aguardar(check, descricao, limite = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    try { const resultado = await check(); if (resultado) return resultado; } catch { /* ainda inicializando */ }
    await esperar(100);
  }
  throw new Error(`Tempo esgotado: ${descricao}`);
}

async function main() {
  const workspace = path.resolve(__dirname, '..', '..');
  const pasta = path.join(workspace, '.verification');
  await fs.mkdir(pasta, { recursive: true });
  const perfil = await fs.mkdtemp(path.join(pasta, 'chrome-'));
  const front = path.join(workspace, 'Front');
  const portaVite = 5180;
  const [plano] = planejarMigracao(produtosMatriz());
  let modelo = new Produto({ _id: plano.id, ...plano.campos }).toObject();
  modelo.imagem = `http://127.0.0.1:${portaVite}/LogoEscrthinny.jpg`;
  modelo.variants.forEach(v => { v.imagens = [modelo.imagem]; });
  Produto.find = () => ({ sort() { return this; }, async lean() { return [modelo]; } });
  Produto.findById = async id => String(id) === String(modelo._id) ? new Produto(modelo) : null;
  Produto.findByIdAndUpdate = async (id, update) => {
    if (String(id) !== String(modelo._id)) return null;
    const candidato = new Produto({ ...modelo, ...update });
    await candidato.validate();
    modelo = candidato.toObject();
    return candidato;
  };
  let ultimoPedido;
  Pedido.create = async dados => { ultimoPedido = dados; return dados; };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', `http://127.0.0.1:${portaVite}`);
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api/produtos', require('../routes/produtos'));
  app.use('/api/filtros', require('../routes/filtros'));
  app.use('/api/pedidos', require('../routes/pedidos'));
  const servidor = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const processos = [];
  let socket;
  let cdp;
  try {
    const vite = spawn(process.execPath, [path.join(front, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(portaVite), '--strictPort'], {
      cwd: front, windowsHide: true, env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${servidor.address().port}` }, stdio: ['ignore', 'pipe', 'pipe']
    });
    processos.push(vite);
    let logVite = '';
    vite.stdout.on('data', data => { logVite += data.toString(); });
    vite.stderr.on('data', data => { logVite += data.toString(); });
    await aguardar(async () => {
      if (vite.exitCode !== null) throw new Error(logVite);
      return (await fetch(`http://127.0.0.1:${portaVite}`)).ok;
    }, 'Vite');
    const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-gpu', '--window-size=1440,1100', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.on('data', data => process.stderr.write(data));
    processos.push(chrome);
    const porta = await aguardar(async () => Number((await fs.readFile(path.join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]), 'Chrome');
    const alvo = await aguardar(async () => (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find(p => p.type === 'page'), 'aba');
    socket = new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequencia = 0;
    const pendentes = new Map();
    const erros = [];
    socket.addEventListener('close', () => {
      for (const promessa of pendentes.values()) promessa.reject(new Error('Chrome encerrou a conexão CDP.'));
      pendentes.clear();
    });
    socket.addEventListener('message', event => {
      const mensagem = JSON.parse(event.data);
      if (mensagem.id) {
        const promessa = pendentes.get(mensagem.id);
        pendentes.delete(mensagem.id);
        if (mensagem.error) promessa?.reject(new Error(mensagem.error.message)); else promessa?.resolve(mensagem.result);
      }
      if (mensagem.method === 'Runtime.exceptionThrown') erros.push(mensagem.params.exceptionDetails.text);
    });
    cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequencia;
      const timeout = setTimeout(() => { pendentes.delete(id); reject(new Error(`CDP sem resposta: ${method}`)); }, 20000);
      pendentes.set(id, { resolve: data => { clearTimeout(timeout); resolve(data); }, reject: error => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const avaliar = async expression => {
      const resultado = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.exception?.description || resultado.exceptionDetails.text);
      return resultado.result.value;
    };
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls: ['*images.unsplash.com*', '*googleapis.com*', '*fonts.gstatic.com*', '*cdn.jsdelivr.net*', '*catalogo-placetech.diego-placetech.chatgpt.site*'] });
    await cdp('Page.enable');
    await cdp('Page.navigate', { url: `http://127.0.0.1:${portaVite}/` });
    console.log('Browser: catálogo aberto.');
    await aguardar(() => avaliar("document.querySelectorAll('article.card').length === 1"), 'card agrupado');
    assert.ok(await avaliar("document.querySelector('article.card').textContent.includes('A partir de')"));
    const selecionar = (campo, valor) => avaliar(`(() => { const s = document.querySelectorAll('.variant-filters select')[${campo}]; s.value = ${JSON.stringify(valor)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await selecionar(0, 'Apple');
    await aguardar(() => avaliar("!document.querySelector('.variant-status')"), 'filtro marca');
    await selecionar(1, 'Lacrado');
    await aguardar(() => avaliar("!document.querySelector('.variant-status')"), 'filtro categoria');
    await selecionar(2, 'iPhone 17 Pro Max');
    await aguardar(() => avaliar("!document.querySelector('.variant-status')"), 'filtro modelo');
    assert.equal(await avaliar("document.querySelectorAll('.variant-filters select')[3].options.length"), 4);
    await selecionar(3, 'Deep Blue');
    await aguardar(() => avaliar("!document.querySelector('.variant-status')"), 'filtro cor');
    await selecionar(4, '512GB');
    await aguardar(() => avaliar("!document.querySelector('.variant-status')"), 'filtro capacidade');
    await avaliar("document.querySelector('a.ask').click()");
    console.log('Browser: filtros em cascata selecionados.');
    await aguardar(() => avaliar("!!document.querySelector('.variant-detail')"), 'detalhe');
    assert.ok(await avaliar("document.querySelector('.variant-meta').textContent.includes('Sob encomenda')"));
    assert.equal(await avaliar("document.querySelector('.variant-price').textContent"), 'R$ 8.100,00');
    await avaliar("document.querySelector('.variant-buy').click()");
    await avaliar("Array.from(document.querySelectorAll('.variant-option')).find(b=>b.textContent==='Cosmic Orange').click()");
    await aguardar(() => avaliar("document.querySelector('.variant-price').textContent.includes('8.200')"), 'preço da outra cor');
    await avaliar("document.querySelector('.variant-buy').click()");
    await avaliar("document.querySelector('.variant-nav button').click()");
    await aguardar(() => avaliar("document.body.textContent.includes('SKU: PT-000000000000000000000005') && document.body.textContent.includes('SKU: PT-000000000000000000000008')"), 'SKUs separados no carrinho');
    await avaliar("document.querySelector('[placeholder=\"Seu nome completo\"]').focus()");
    await cdp('Input.insertText', { text: 'Cliente teste' });
    await avaliar("document.querySelector('[placeholder=\"Telefone com DDD\"]').focus()");
    await cdp('Input.insertText', { text: '11999999999' });
    // Intercepta a saída ao WhatsApp mantendo a verificação inteiramente local.
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*wa.me/*', requestStage: 'Request' }] });
    socket.addEventListener('message', event => {
      const mensagem = JSON.parse(event.data);
      if (mensagem.method === 'Fetch.requestPaused') cdp('Fetch.failRequest', { requestId: mensagem.params.requestId, errorReason: 'Aborted' }).catch(() => {});
    });
    await avaliar("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Enviar via WhatsApp')).click()");
    await aguardar(() => ultimoPedido, 'pedido com variantes');
    console.log('Browser: pedido recebido.');
    assert.equal(ultimoPedido.itens.length, 2);
    assert.equal(ultimoPedido.total, 16300);
    assert.deepEqual(ultimoPedido.itens.map(i => i.sku), ['PT-000000000000000000000005', 'PT-000000000000000000000008']);
    await cdp('Page.navigate', { url: `http://127.0.0.1:${portaVite}/produto/${modelo._id}` });
    await aguardar(() => avaliar("!!document.querySelector('.variant-detail')"), 'detalhe para screenshot');
    await esperar(500);
    const desktop = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await fs.writeFile(path.join(pasta, 'produto-desktop.png'), Buffer.from(desktop.data, 'base64'));
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await esperar(300);
    assert.ok(await avaliar('document.documentElement.scrollWidth <= window.innerWidth'));
    const mobile = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await fs.writeFile(path.join(pasta, 'produto-mobile.png'), Buffer.from(mobile.data, 'base64'));
    await cdp('Emulation.clearDeviceMetricsOverride');
    const tokenTeste = require('jsonwebtoken').sign({ admin: true }, process.env.JWT_SECRET || 'placetech-dev-secret', { expiresIn: '5m' });
    await avaliar(`localStorage.setItem('catalogo_admin_token', ${JSON.stringify(tokenTeste)})`);
    await cdp('Page.navigate', { url: `http://127.0.0.1:${portaVite}/loja/produtos` });
    await aguardar(() => avaliar("!!document.querySelector('button[title=\"Editar\"]')"), 'painel administrativo');
    await avaliar("document.querySelector('button[title=\"Editar\"]').click()");
    await aguardar(() => avaliar("!!document.querySelector('.variant-editor')"), 'editor de variantes');
    const estoqueCampos = await avaliar("Array.from(document.querySelectorAll('.variant-editor input[placeholder=\"Sob encomenda\"]')).map(i=>i.value)");
    assert.equal(estoqueCampos.length, 9);
    assert.ok(estoqueCampos.every(valor => valor === ''));
    await avaliar("document.querySelectorAll('.variant-editor-row')[2].querySelectorAll('input')[4].focus()");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await cdp('Input.insertText', { text: '7600' });
    await avaliar("document.querySelector('.variant-editor button[type=submit]').click()");
    await aguardar(() => modelo.variants[0].preco === 7600, 'edição de preço da variante');
    assert.equal(modelo.variants[1].preco, 8000);
    assert.ok(modelo.variants.every(v => v.estoque === null));
    assert.deepEqual(erros, []);
    console.log('Browser OK: card agrupado, filtros em cascata, cor/capacidade, preço, dois SKUs no carrinho, pedido validado, edição administrativa e layout mobile sem overflow.');
    console.log(`Capturas: ${pasta}`);
  } finally {
    if (cdp && socket?.readyState === WebSocket.OPEN) await cdp('Browser.close').catch(() => {});
    socket?.close();
    processos.forEach(processo => { if (processo.exitCode === null) processo.kill(); });
    await new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); });
  }
}

main().catch(erro => { console.error(erro); process.exitCode = 1; });
