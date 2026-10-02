const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const ConfiguracaoTroca = require('../models/ConfiguracaoTroca');

test('configuração do checklist é pública para leitura e somente admin pode atualizar', async t => {
  let checklist = ['Remova a capinha antes de fotografar'];
  let atualizacoes = 0;
  t.mock.method(ConfiguracaoTroca, 'findOne', filtro => {
    assert.deepEqual(filtro, { chave: 'troca' });
    return { lean: async () => ({ checklist }) };
  });
  t.mock.method(ConfiguracaoTroca, 'findOneAndUpdate', (filtro, atualizacao) => {
    atualizacoes++;
    assert.deepEqual(filtro, { chave: 'troca' });
    checklist = atualizacao.$set.checklist;
    return { lean: async () => ({ checklist }) };
  });

  const app = express();
  app.use(express.json());
  app.use('/troca', require('../routes/tradein'));
  const servidor = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));

  const base = `http://127.0.0.1:${servidor.address().port}/troca/configuracoes`;
  const segredo = process.env.JWT_SECRET || 'placetech-dev-secret';
  const admin = { Authorization: `Bearer ${jwt.sign({ perfil: 'admin' }, segredo)}` };
  const cliente = { Authorization: `Bearer ${jwt.sign({ perfil: 'cliente' }, segredo)}` };

  const leitura = await fetch(base);
  assert.equal(leitura.status, 200);
  assert.deepEqual(await leitura.json(), { checklist });
  assert.equal((await fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist: [] }) })).status, 401);
  assert.equal((await fetch(base, { method: 'PUT', headers: { ...cliente, 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist: [] }) })).status, 403);

  const salvar = async itens => fetch(base, { method: 'PUT',
    headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ checklist: itens }) });
  const resposta = await salvar(['  Retire a capinha  ', 'Fotografe o aparelho com boa iluminação']);
  assert.equal(resposta.status, 200);
  assert.deepEqual((await resposta.json()).checklist, ['Retire a capinha', 'Fotografe o aparelho com boa iluminação']);
  assert.equal((await salvar(['Item repetido', ' item repetido '])).status, 400);
  assert.equal((await salvar(Array(31).fill('Item'))).status, 400);
  assert.equal(atualizacoes, 1);
});
