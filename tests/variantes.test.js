const { test } = require('node:test');
const assert = require('node:assert/strict');
const Produto = require('../models/Produto');
const { agruparProdutos, identificarProduto, filtrarProdutos, listarFiltros } = require('../utils/variantes');
const { planejarMigracao } = require('../scripts/migrar-variantes');
const { validarItensPedido } = require('../utils/itensPedido');
const { produtosMatriz } = require('./fixtures/variantes');

test('3 cores × 3 capacidades viram 9 variantes em um único documento válido', async () => {
  const legados = produtosMatriz();
  const plano = planejarMigracao(legados);
  assert.equal(plano.length, 1);
  assert.equal(plano[0].removerIds.length, 8);
  const produto = new Produto({ _id: plano[0].id, ...plano[0].campos });
  await produto.validate();
  assert.equal(produto.nome, 'iPhone 17 Pro Max');
  assert.equal(produto.marca, 'Apple');
  assert.equal(produto.categoria, 'Lacrado');
  assert.equal(produto.variants.length, 9);
  assert.equal(new Set(produto.variants.map(v => v.sku)).size, 9);
  assert.ok(produto.variants.every(v => v.estoque === null));
  assert.equal(produto.variants[8].preco, legados[8].precoPersonalizado);
  assert.deepEqual(produto.variants[8].imagens, [legados[8].imagem]);
  assert.equal(planejarMigracao([produto.toObject()]).length, 0);
  produto.set({ specs: { 'câmera': '48 MP' } });
  assert.equal(produto.toObject().specs.camera, '48 MP');
});

test('migração separa condição, preserva preços padrão e indisponibilidade e recusa combinações repetidas', () => {
  const legados = produtosMatriz();
  legados[0].disponivel = false;
  delete legados[1].precoPersonalizado;
  const cpo = { ...legados[2], _id: '000000000000000000000099', categoria: 'iPhones CPO' };
  const plano = planejarMigracao([...legados, cpo]);
  assert.equal(plano.length, 2);
  assert.equal(plano[0].campos.variants[0].estoque, 0);
  assert.equal(plano[0].campos.variants[0].disponivel, false);
  assert.equal(plano[0].campos.variants[1].preco, Number((legados[1].preco * 1.07 + 500).toFixed(2)));
  assert.throws(() => planejarMigracao([...legados, { ...legados[0], _id: '000000000000000000000098' }]), /combinação repetida/);
});

test('nomes reais: cores compostas, condição após a cor, CPO e tamanhos de Watch', () => {
  const exemplos = [
    ['iPhone 17 Air 256GB Light Gold', 'iPhone 17 Air', 'Dourado Claro', '256GB'],
    ['iPhone 17 256GB Verde Sage', 'iPhone 17', 'Verde Sage', '256GB'],
    ['iPhone 15 128GB Preto (Não ativado)', 'iPhone 15', 'Preto', '128GB'],
    ['iPhone 16 Pro Max 256GB CPO Desert Titanium', 'iPhone 16 Pro Max', 'Titânio Deserto', '256GB'],
    ['Apple Watch Series 11 42mm Preto Jateado', 'Apple Watch Series 11', 'Preto Jateado', '42mm'],
    ['iPhone 14 Plus 128GB CPO Meia-Noite', 'iPhone 14 Plus', 'Meia-noite', '128GB']
  ];
  for (const [nome, modelo, cor, capacidade] of exemplos) {
    const identidade = identificarProduto({ nome, categoria: nome.includes('CPO') ? 'iPhones CPO' : 'iPhones Lacrados' });
    assert.equal(identidade.nome, modelo);
    assert.equal(identidade.cor, cor);
    assert.equal(identidade.capacidade, capacidade);
  }
});

test('filtros em cascata consideram somente combinações da mesma variante e seu preço', () => {
  const produtos = agruparProdutos(produtosMatriz());
  const matriz = produtos[0];
  matriz.variants[0].estoque = 0;
  const outro = agruparProdutos([{ ...produtosMatriz()[0], _id: '000000000000000000000099', nome: 'Xiaomi 15 128GB Verde', categoria: 'Lacrado' }])[0];
  const filtros = listarFiltros([...produtos, outro], { marca: 'Apple', categoria: 'Lacrado', modelo: matriz.nome, cor: 'Prata' });
  assert.deepEqual(filtros.marcas, ['Apple', 'Xiaomi']);
  assert.deepEqual(filtros.modelos, ['iPhone 17 Pro Max']);
  assert.deepEqual(filtros.cores, ['Cosmic Orange', 'Deep Blue', 'Prata']);
  assert.deepEqual(filtros.capacidades, ['1TB', '512GB']);
  const selecionado = filtrarProdutos(produtos, { cor: 'Deep Blue', capacidade: '512GB' });
  assert.equal(selecionado[0].variants.length, 1);
  assert.equal(selecionado[0].precoAPartir, matriz.variants[4].preco);
  assert.equal(filtrarProdutos(produtos, { cor: 'Prata', capacidade: '256GB' }).length, 0);
});

test('pedido preserva variantes separadas, recalcula preço, agrega quantidades e aceita carrinhos antigos', () => {
  const legados = produtosMatriz();
  const [produto] = agruparProdutos(legados);
  const itens = validarItensPedido(legados, [
    { produtoId: produto._id, variantId: produto.variants[0]._id, sku: produto.variants[0].sku, preco: 1, quantidade: 2 },
    { produtoId: produto._id, variantId: produto.variants[4]._id, preco: 1, quantidade: 1 },
    { produtoId: produto._id, variantId: produto.variants[0]._id, quantidade: 1 }
  ]);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].quantidade, 3);
  assert.equal(itens[0].preco, legados[0].precoPersonalizado);
  assert.equal(itens[1].sku, produto.variants[4].sku);
  assert.equal(itens[1].cor, 'Deep Blue');
  const plano = planejarMigracao(legados);
  const migrado = { _id: plano[0].id, ...plano[0].campos };
  const antigo = validarItensPedido([migrado], [{ produtoId: legados[8]._id, quantidade: 5 }]);
  assert.equal(antigo[0].sku, produto.variants[8].sku);
  assert.equal(antigo[0].preco, legados[8].precoPersonalizado);
  assert.equal(String(antigo[0].produtoId), String(migrado._id));
});

test('pedido rejeita SKU forjado, variante de outro modelo, indisponibilidade e estoque insuficiente agregado', () => {
  const plano = planejarMigracao(produtosMatriz());
  const produto = { _id: plano[0].id, ...plano[0].campos };
  const item = { produtoId: produto._id, variantId: produto.variants[0]._id, quantidade: 1 };
  assert.throws(() => validarItensPedido([produto], [{ ...item, sku: 'FORJADO' }]), /SKU/);
  assert.throws(() => validarItensPedido([produto], [{ ...item, variantId: 'outro' }]), /variante/);
  assert.throws(() => validarItensPedido([produto], [{ ...item, quantidade: 1.5 }]), /quantidade/);
  produto.variants[0].estoque = 1;
  assert.throws(() => validarItensPedido([produto], [item, item]), /Quantidade indisponível/);
  produto.variants[0].disponivel = false;
  assert.throws(() => validarItensPedido([produto], [item]), /variante/);
});

test('schema rejeita SKU/combinacão repetida, preço negativo e estoque fracionário', async () => {
  const plano = planejarMigracao(produtosMatriz());
  const criar = () => new Produto({ _id: plano[0].id, ...plano[0].campos });
  const preco = criar();
  preco.variants[0].preco = -1;
  await assert.rejects(preco.validate(), erro => Boolean(erro.errors['variants.0.preco']));
  const estoque = criar();
  estoque.variants[1].estoque = 1.5;
  await assert.rejects(estoque.validate(), erro => Boolean(erro.errors['variants.1.estoque']));
  const sku = criar();
  sku.variants[1].sku = sku.variants[0].sku;
  await assert.rejects(sku.validate(), erro => Boolean(erro.errors.variants));
  const combinacao = criar();
  combinacao.variants[1].capacidade = combinacao.variants[0].capacidade;
  await assert.rejects(combinacao.validate(), erro => Boolean(erro.errors.variants));
});
