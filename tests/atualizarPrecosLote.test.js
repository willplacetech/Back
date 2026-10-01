const { test } = require('node:test');
const assert = require('node:assert/strict');
const criarHandler = require('../controllers/atualizarPrecosLote');

test('updates only prices, skips missing and ambiguous names, rejects invalid and repeated entries', async () => {
  const updates = [];
  const Produto = {
    find(query) {
      const pattern = new RegExp(query.nome.$regex, query.nome.$options);
      const catalogo = [{ _id: '1', nome: 'Item (A)' }, { _id: '2', nome: 'Duplicado' }, { _id: '3', nome: 'Duplicado' }];
      return { limit: async () => catalogo.filter(p => pattern.test(p.nome)).slice(0, 2) };
    },
    async findByIdAndUpdate(id, update, options) {
      updates.push({ id, update, options });
      return { _id: id, nome: 'Item (A)' };
    }
  };
  let resposta;
  await criarHandler(Produto)({ body: { produtos: [
    { nome: ' item (a) ', preco: '1.250,00', categoria: 'Changed', imagem: 'changed', disponivel: false },
    { nome: 'Ausente', preco: 100 },
    { nome: 'Duplicado', preco: 100 },
    { nome: 'Item (A)', preco: 200 },
    { nome: 'Invalido', preco: 100, precoPersonalizado: -1 },
    null
  ] } }, { json(data) { resposta = data; } });
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].update, { $set: { preco: 1250 } });
  assert.equal(updates[0].options.runValidators, true);
  assert.equal(resposta.resultados.sucesso.length, 1);
  assert.equal(resposta.resultados.ignorados.length, 1);
  assert.equal(resposta.resultados.erros.length, 4);
});

test('updates sale price when provided and rejects empty lists', async () => {
  let update;
  const Produto = {
    find: () => ({ limit: async () => [{ _id: '1' }] }),
    findByIdAndUpdate: async (_, campos) => { update = campos; return { _id: '1', nome: 'A' }; }
  };
  const handler = criarHandler(Produto);
  await handler({ body: { produtos: [{ nome: 'A', preco: 10, precoPersonalizado: 20 }] } }, { json() {} });
  assert.deepEqual(update, { $set: { preco: 10, precoPersonalizado: 20 } });
  let status;
  await handler({ body: { produtos: [] } }, { status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 400);
});
