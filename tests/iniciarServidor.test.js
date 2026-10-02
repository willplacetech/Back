const { test } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('../utils/iniciarServidor');

test('não recebe pedidos antes de conectar e garantir o índice único da troca', async () => {
  const eventos = [];
  let liberarBanco, liberarIndice;
  const banco = new Promise(resolve => { liberarBanco = resolve; });
  const indice = new Promise(resolve => { liberarIndice = resolve; });
  const execucao = iniciarServidor({
    conectar: () => { eventos.push('conectar'); return banco; },
    prepararIndices: () => { eventos.push('indice'); return indice; },
    iniciar: () => { eventos.push('escutar'); return 'servidor'; }
  });
  assert.deepEqual(eventos, ['conectar']);
  liberarBanco(); await Promise.resolve();
  assert.deepEqual(eventos, ['conectar', 'indice']);
  liberarIndice();
  assert.equal(await execucao, 'servidor');
  assert.deepEqual(eventos, ['conectar', 'indice', 'escutar']);
});

test('falha na criação do índice impede o servidor de aceitar pedidos', async () => {
  let iniciou = false;
  await assert.rejects(iniciarServidor({ conectar: async () => {}, prepararIndices: async () => { throw new Error('índice indisponível'); },
    iniciar: () => { iniciou = true; } }), /índice indisponível/);
  assert.equal(iniciou, false);
});
