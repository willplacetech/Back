const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const Produto = require('../models/Produto');
const Pedido = require('../models/Pedido');
const TradeIn = require('../models/TradeIn');

test('pedido associa troca autorizada e desconta oferta do servidor uma única vez', async t => {
  const id = '012345678901234567890123';
  let status = 'aprovado';
  let valorOferta = 1200;
  let pedidoAtivo = false;
  t.mock.method(Pedido, 'exists', async () => pedidoAtivo);
  const salvos = [];
  t.mock.method(Produto, 'find', () => ({ lean: async () => [{
    _id: '112345678901234567890123', nome: 'iPhone 16', marca: 'Apple', disponivel: true,
    variants: [{ _id: '212345678901234567890123', sku: 'IP16', cor: 'Preto', capacidade: '256GB', preco: 4000, estoque: 3 }]
  }] }));
  t.mock.method(TradeIn, 'findById', () => ({ select: async () => ({
    _id: id, userId: null, status, valorOferta,
    acessoTokenHash: crypto.createHash('sha256').update('segredo').digest('hex')
  }) }));
  t.mock.method(Pedido, 'create', async dados => { salvos.push(dados); return dados; });
  const app = express();
  app.use(express.json());
  app.use('/pedidos', require('../routes/pedidos'));
  app.use('/troca', require('../routes/tradein'));
  const servidor = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  const enviar = token => fetch(`http://127.0.0.1:${servidor.address().port}/pedidos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Troca-Token': token } : {}) },
    body: JSON.stringify({ tradeInId: id, valorTroca: 3999, total: 1,
      itens: [{ produtoId: '112345678901234567890123', variantId: '212345678901234567890123', quantidade: 2 }],
      dadosCliente: { nome: 'Cliente', telefone: '11999999999' } })
  });
  const detalhe = token => fetch(`http://127.0.0.1:${servidor.address().port}/troca/${id}`, {
    headers: token ? { 'X-Troca-Token': token } : {}
  });
  const autorizado = await detalhe('segredo');
  assert.equal(autorizado.status, 200);
  assert.equal((await autorizado.json()).acessoTokenHash, undefined);
  assert.equal((await detalhe('errado')).status, 404);
  assert.equal((await detalhe()).status, 404);
  const resposta = await enviar('segredo');
  assert.equal(resposta.status, 201);
  const pedido = (await resposta.json()).pedido;
  assert.equal(pedido.tradeInId, id);
  assert.equal(pedido.valorTroca, 1200);
  assert.equal(pedido.total, 6800);
  pedidoAtivo = true;
  assert.equal((await enviar('segredo')).status, 409);
  pedidoAtivo = false;
  assert.equal((await enviar('errado')).status, 404);
  assert.equal((await enviar()).status, 404);
  assert.equal(salvos.length, 1);
  status = 'pendente';
  const pendente = (await (await enviar('segredo')).json()).pedido;
  assert.equal(pendente.valorTroca, 0);
  assert.equal(pendente.total, 8000);
  status = 'concluido';
  assert.equal((await enviar('segredo')).status, 400);
  status = 'rejeitado';
  assert.equal((await enviar('segredo')).status, 400);
  status = 'aprovado'; valorOferta = 9000;
  const integral = (await (await enviar('segredo')).json()).pedido;
  assert.equal(integral.total, 0);
  assert.equal(integral.valorTroca, 8000);
  // Simula o conflito atômico do índice: outra requisição chegou entre exists e create.
  t.mock.method(Pedido, 'create', async () => { throw Object.assign(new Error('duplicate key'), { code: 11000 }); });
  assert.equal((await enviar('segredo')).status, 409);
});
