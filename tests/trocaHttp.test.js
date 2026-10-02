const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const TradeIn = require('../models/TradeIn');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinaryTroca');
const { CAMPOS_FOTOS } = require('../middleware/uploadTroca');

test('HTTP troca: perfil autenticado, upload completo, protocolo, pendência e validação antes do Cloudinary', async t => {
  const userId = new mongoose.Types.ObjectId();
  const salvos = [];
  const assets = [];
  const subir = t.mock.method(cloudinary, 'subirFotos', async (files, id) => {
    assert.deepEqual(Object.keys(files).sort(), [...CAMPOS_FOTOS].sort());
    return { fotos: Object.fromEntries(CAMPOS_FOTOS.map(campo => [campo, `https://example.com/${id}/${campo}.png`])), assets };
  });
  t.mock.method(TradeIn, 'exists', async () => false);
  t.mock.method(TradeIn.prototype, 'save', async function () { await this.validate(); salvos.push(this); return this; });
  t.mock.method(User, 'findById', id => ({ async lean() {
    return String(id) === String(userId) ? { _id: userId, nome: 'Cliente logado', email: 'logado@example.com', telefone: '21999999999', ativo: true, interno: 'não expor' } : null;
  } }));

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/troca', require('../routes/tradein'));
  const servidor = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;
  const segredo = process.env.JWT_SECRET || 'placetech-dev-secret';
  const token = jwt.sign({ userId: String(userId) }, segredo, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await fetch(`${base}/auth/me`)).status, 401);
  const perfil = await fetch(`${base}/auth/me`, { headers });
  assert.equal(perfil.status, 200);
  assert.deepEqual(await perfil.json(), { user: { nome: 'Cliente logado', email: 'logado@example.com', telefone: '21999999999' } });
  const admin = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${jwt.sign({ perfil: 'admin' }, segredo)}` } });
  assert.deepEqual(await admin.json(), { user: null });

  const corpo = (campos = {}, fotos = CAMPOS_FOTOS) => {
    const form = new FormData();
    const dados = { modeloAparelho: 'iPhone 15', capacidade: '128GB', cor: 'Azul', imei: '490154203237518',
      nome: 'Cliente visitante', email: 'visitante@example.com', telefone: '11999999999', descricaoEstado: 'Tela sem riscos', ...campos };
    for (const [chave, valor] of Object.entries(dados)) if (valor !== undefined) form.append(chave, valor);
    for (const campo of fotos) form.append(campo, new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), `${campo}.png`);
    return form;
  };

  const resposta = await fetch(`${base}/troca`, { method: 'POST', body: corpo({ status: 'aprovado', userId: String(userId) }) });
  assert.equal(resposta.status, 201);
  const troca = await resposta.json();
  assert.equal(troca.sucesso, true);
  assert.equal(troca.protocolo, troca.id);
  assert.equal(troca.status, 'pendente');
  assert.match(troca.acessoToken, /^[a-f0-9]{64}$/);
  assert.equal(salvos[0].userId, null);
  assert.equal(salvos[0].nome, 'Cliente visitante');
  assert.equal(salvos[0].historico[0].status, 'pendente');
  assert.ok(salvos[0].historico[0].data instanceof Date);
  assert.equal(subir.mock.callCount(), 1);

  const logado = await fetch(`${base}/troca`, { method: 'POST', headers, body: corpo({ nome: undefined, email: undefined, telefone: undefined }) });
  assert.equal(logado.status, 201);
  assert.equal((await logado.json()).acessoToken, undefined);
  assert.equal(String(salvos[1].userId), String(userId));
  assert.equal(salvos[1].email, 'logado@example.com');

  const semFoto = await fetch(`${base}/troca`, { method: 'POST', body: corpo({}, CAMPOS_FOTOS.slice(0, 4)) });
  assert.equal(semFoto.status, 400);
  const semNome = await fetch(`${base}/troca`, { method: 'POST', body: corpo({ nome: '' }) });
  assert.equal(semNome.status, 400);
  const imeiInvalido = await fetch(`${base}/troca`, { method: 'POST', body: corpo({ imei: '123' }) });
  assert.equal(imeiInvalido.status, 400);
  assert.equal(subir.mock.callCount(), 2);

  t.mock.method(TradeIn, 'exists', async () => true);
  const duplicado = await fetch(`${base}/troca`, { method: 'POST', body: corpo() });
  assert.equal(duplicado.status, 409);
  assert.equal(subir.mock.callCount(), 2);
});
