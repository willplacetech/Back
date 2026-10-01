const { test } = require('node:test');
const assert = require('node:assert/strict');
const criarHandler = require('../controllers/atualizarPrecosLote');

test('updates only prices, skips missing and ambiguous names, rejects invalid and repeated entries', async () => {
  const updates = [];
  const Produto = {
    find(query) {
      if (!query.nome) return { limit: async () => [] };
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

test('importação de preços encontra nome legado e altera somente a variante correspondente', async () => {
  const { agruparProdutos } = require('../utils/variantes');
  const { produtosMatriz } = require('./fixtures/variantes');
  const [produto] = agruparProdutos(produtosMatriz());
  const atualizacoes = [];
  const model = {
    find(query) {
      const campo = query.nome ? 'nome' : 'variants.nomeLegado';
      const filtro = query[campo];
      const regex = new RegExp(filtro.$regex, filtro.$options);
      return { limit: async () => (campo === 'nome' ? regex.test(produto.nome) : produto.variants.some(v => regex.test(v.nomeLegado))) ? [produto] : [] };
    },
    async findOneAndUpdate(query, update) { atualizacoes.push({ query, update }); return produto; }
  };
  let resposta;
  await criarHandler(model)({ body: { produtos: [
    { nome: 'iPhone 17 Pro Max 512GB Deep Blue', preco: 6800, precoPersonalizado: 8900 },
    { nome: 'iPhone 17 Pro Max', preco: 200, precoPersonalizado: 300 }
  ] } }, { json(data) { resposta = data; } });
  assert.equal(atualizacoes.length, 1);
  assert.equal(String(atualizacoes[0].query['variants._id']), String(produto.variants[4]._id));
  assert.deepEqual(atualizacoes[0].update, { $set: { 'variants.$.precoCusto': 6800, 'variants.$.preco': 8900 } });
  assert.equal(resposta.resultados.erros.length, 1);
});
