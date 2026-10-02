const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const TradeIn = require('../models/TradeIn');
const User = require('../models/User');

test('admin filtra, exporta CSV seguro e registra decisões visíveis somente ao dono', async t => {
  const userId = new mongoose.Types.ObjectId();
  const troca = new TradeIn({
    _id: new mongoose.Types.ObjectId(), userId, nome: '=HYPERLINK("teste")', email: 'cliente@example.com', telefone: '11999999999',
    modeloAparelho: 'iPhone 15', capacidade: '128GB', cor: 'Preto', imei: '490154203237518',
    descricaoEstado: 'Sem riscos', fotos: Object.fromEntries(['frontal', 'superior', 'inferior', 'lateralEsq', 'lateralDir'].map(c => [c, `https://example.com/${c}.jpg`])),
    createdAt: new Date('2026-10-02T10:00:00Z'), acessoTokenHash: 'privado',
    historico: [{ status: 'pendente', data: new Date('2026-10-02T10:00:00Z') }]
  });
  t.mock.method(User, 'findById', id => ({ lean: async () => ({ _id: id, ativo: true, nome: 'Cliente', email: 'cliente@example.com' }) }));
  t.mock.method(TradeIn, 'find', filtro => ({ sort: async () =>
    (!filtro.userId || String(filtro.userId) === String(userId)) && (!filtro.status || filtro.status === troca.status) ? [troca] : [] }));
  t.mock.method(TradeIn, 'findById', id => ({ select: async () => String(id) === String(troca._id) ? troca : null }));
  t.mock.method(TradeIn, 'findByIdAndUpdate', async (id, atualizacao) => {
    if (String(id) !== String(troca._id)) return null;
    Object.assign(troca, atualizacao.$set);
    if (atualizacao.$push?.historico) troca.historico.push(atualizacao.$push.historico);
    await troca.validate();
    return troca;
  });
  const app = express(); app.use(express.json());
  app.use('/auth', require('../routes/auth')); app.use('/troca', require('../routes/tradein'));
  const servidor = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const segredo = process.env.JWT_SECRET || 'placetech-dev-secret';
  const admin = { Authorization: `Bearer ${jwt.sign({ perfil: 'admin' }, segredo)}` };
  const cliente = { Authorization: `Bearer ${jwt.sign({ userId: String(userId) }, segredo)}` };
  const outro = { Authorization: `Bearer ${jwt.sign({ userId: String(new mongoose.Types.ObjectId()) }, segredo)}` };
  const patch = body => fetch(`${base}/troca/${troca._id}/status`, { method: 'PATCH', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/auth/admin`, { headers: admin })).status, 200);
  assert.equal((await fetch(`${base}/auth/admin`, { headers: cliente })).status, 403);
  for (const path of ['/troca/admin', '/troca/admin/exportar', `/troca/admin/${troca._id}`]) {
    assert.equal((await fetch(base + path)).status, 401);
    assert.equal((await fetch(base + path, { headers: cliente })).status, 403);
  }
  const lista = await fetch(`${base}/troca/admin?status=pendente`, { headers: admin });
  assert.equal(lista.status, 200);
  const dados = await lista.json();
  assert.equal(dados.length, 1);
  assert.equal(dados[0].acessoTokenHash, undefined);
  assert.equal((await fetch(`${base}/troca/admin?status=invalido`, { headers: admin })).status, 400);
  assert.equal((await patch({ status: 'aprovado' })).status, 400);
  assert.equal((await patch({ status: 'aprovado', valorOferta: -1 })).status, 400);
  assert.equal((await patch({ status: 'rejeitado', motivoRejeicao: '   ' })).status, 400);
  assert.equal((await patch({ status: 'em_avaliacao' })).status, 200);
  const aprovado = await patch({ status: 'aprovado', valorOferta: 1500.25 });
  assert.equal(aprovado.status, 200);
  const minhas = await fetch(`${base}/troca/mid`, { headers: cliente });
  const minhasDados = await minhas.json();
  assert.equal(minhasDados[0].status, 'aprovado');
  assert.equal(minhasDados[0].valorOferta, 1500.25);
  assert.deepEqual(minhasDados[0].historico.map(e => e.status), ['pendente', 'em_avaliacao', 'aprovado']);
  assert.equal(minhasDados[0].historico[2].valorOferta, 1500.25);
  assert.deepEqual(await (await fetch(`${base}/troca/mid`, { headers: outro })).json(), []);
  assert.equal((await fetch(`${base}/troca/${troca._id}`, { headers: outro })).status, 404);
  const csv = await fetch(`${base}/troca/admin/exportar?status=aprovado`, { headers: admin });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const conteudo = await csv.text();
  assert.match(conteudo, /Protocolo/);
  assert.match(conteudo, /1500,25/);
  assert.ok(conteudo.includes('"\'=HYPERLINK(""teste"")"'));
  assert.ok(!conteudo.includes('privado'));
  const rejeitado = await patch({ status: 'rejeitado', motivoRejeicao: 'Tela danificada' });
  assert.equal(rejeitado.status, 200);
  assert.equal((await rejeitado.json()).solicitacao.valorOferta, null);
  assert.equal(troca.historico.at(-1).motivoRejeicao, 'Tela danificada');
});
