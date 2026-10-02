const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const TradeIn = require('../models/TradeIn');
const { imeiValido } = require('../utils/imei');

const dadosValidos = () => ({
  nome: 'Cliente teste', email: 'CLIENTE@example.com', telefone: '11999999999',
  modeloAparelho: 'iPhone 15', capacidade: '256GB', cor: 'Preto', imei: '490154203237518',
  descricaoEstado: 'Sem avarias',
  fotos: Object.fromEntries(['frontal', 'superior', 'inferior', 'lateralEsq', 'lateralDir'].map(campo => [campo, `https://example.com/${campo}.jpg`]))
});

test('IMEI exige 15 dígitos e checksum Luhn correto', () => {
  assert.equal(imeiValido('490154203237518'), true);
  assert.equal(imeiValido('356938035643809'), true);
  for (const imei of ['490154203237519', '49015420323751', '4901542032375180', '49015420323751x', ' 490154203237518', 490154203237518, null]) {
    assert.equal(imeiValido(imei), false);
  }
});

test('schema valida contato de visitante, cinco URLs, status e índice único', async () => {
  const troca = new TradeIn(dadosValidos());
  await troca.validate();
  assert.equal(troca.userId, null);
  assert.equal(troca.status, 'pendente');
  assert.equal(troca.email, 'cliente@example.com');
  assert.ok(TradeIn.schema.indexes().some(([campos, options]) => campos.imei === 1 && options.unique));
  assert.equal(TradeIn.schema.options.timestamps, true);
  const semContato = new TradeIn({ ...dadosValidos(), nome: undefined, email: undefined, telefone: undefined });
  await assert.rejects(semContato.validate(), erro => Boolean(erro.errors.nome && erro.errors.email && erro.errors.telefone));
  const comUser = new TradeIn({ ...dadosValidos(), userId: new mongoose.Types.ObjectId(), nome: undefined, email: undefined, telefone: undefined });
  await comUser.validate();
  const semFoto = new TradeIn(dadosValidos());
  semFoto.fotos.frontal = undefined;
  await assert.rejects(semFoto.validate(), erro => Boolean(erro.errors['fotos.frontal']));
  const base64 = new TradeIn(dadosValidos());
  base64.fotos.frontal = 'data:image/png;base64,AAAA';
  await assert.rejects(base64.validate(), erro => Boolean(erro.errors['fotos.frontal']));
  const luhnInvalido = new TradeIn({ ...dadosValidos(), imei: '490154203237519' });
  await assert.rejects(luhnInvalido.validate(), erro => Boolean(erro.errors.imei));
  const statusInvalido = new TradeIn({ ...dadosValidos(), status: 'qualquer' });
  await assert.rejects(statusInvalido.validate(), erro => Boolean(erro.errors.status));
});
