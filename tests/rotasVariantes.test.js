const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Produto = require('../models/Produto');
const Pedido = require('../models/Pedido');
const { produtosMatriz } = require('./fixtures/variantes');

test('HTTP: listagem pública agrupada, detalhe, filtros, autenticação administrativa e pedido com SKU', async t => {
  const legados = produtosMatriz();
  const query = { sort() { return this; }, async lean() { return legados; } };
  t.mock.method(Produto, 'find', () => query);
  t.mock.method(Pedido, 'create', async dados => dados);
  const app = express();
  app.use(express.json());
  app.use('/api/produtos', require('../routes/produtos'));
  app.use('/api/filtros', require('../routes/filtros'));
  app.use('/api/pedidos', require('../routes/pedidos'));
  const servidor = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  const url = `http://127.0.0.1:${servidor.address().port}/api`;
  const lista = await fetch(`${url}/produtos`);
  assert.equal(lista.status, 200);
  const produtos = await lista.json();
  assert.equal(produtos.length, 1);
  assert.equal(produtos[0].variants.length, 9);
  const detalhe = await fetch(`${url}/produtos/${produtos[0]._id}`);
  assert.equal(detalhe.status, 200);
  assert.equal((await detalhe.json()).variants.length, 9);
  const filtro = await fetch(`${url}/filtros?marca=Apple&modelo=iPhone%2017%20Pro%20Max&cor=Prata`);
  assert.equal(filtro.status, 200);
  assert.equal((await filtro.json()).capacidades.length, 3);
  const capacidade = await fetch(`${url}/produtos?cor=Deep%20Blue&capacidade=512GB`);
  const filtrados = await capacidade.json();
  assert.equal(filtrados[0].variants.length, 1);
  assert.equal((await fetch(`${url}/produtos/administracao`)).status, 401);
  assert.equal((await fetch(`${url}/produtos/relatorio`)).status, 401);
  assert.equal((await fetch(`${url}/produtos/ausente`)).status, 404);
  const variante = produtos[0].variants[4];
  const pedido = await fetch(`${url}/pedidos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    itens: [{ produtoId: produtos[0]._id, variantId: variante._id, sku: variante.sku, quantidade: 2, preco: 0.01 }],
    dadosCliente: { nome: 'Cliente teste', telefone: '11999999999' }, total: 0.02
  }) });
  assert.equal(pedido.status, 201);
  const confirmado = (await pedido.json()).pedido;
  assert.equal(confirmado.itens[0].sku, variante.sku);
  assert.equal(confirmado.total, variante.preco * 2);
  assert.equal(confirmado.itens[0].capacidade, '512GB');
});
