const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { agruparProdutos, resumirProduto } = require('../utils/variantes');
const { chaveDoModelo } = require('../utils/salvarOferta');

function planejarMigracao(produtos, estoquePadrao = null) {
  // Não modifica modelos já migrados; rodar novamente é seguro.
  const legados = produtos.filter(p => !p.variants?.length);
  const existentes = produtos.filter(p => p.variants?.length);
  const grupos = agruparProdutos([...existentes, ...legados], { estoquePadrao, estrito: true });
  return grupos.filter(g => g.idsOriginais.some(id => legados.some(p => String(p._id) === String(id)))).map(grupo => {
    const resumo = resumirProduto(grupo);
    return {
      id: grupo._id,
      removerIds: grupo.idsOriginais.filter(id => String(id) !== String(grupo._id)),
      campos: {
        chaveModelo: chaveDoModelo(grupo),
        nome: grupo.nome, marca: grupo.marca, categoria: grupo.categoria,
        categoriaOriginal: grupo.categoriaOriginal,
        specs: grupo.specs || {}, variants: grupo.variants,
        preco: Math.min(...grupo.variants.map(v => Number(v.precoCusto || v.preco))),
        precoPersonalizado: resumo.precoAPartir,
        disponivel: grupo.disponivel,
        imagem: grupo.imagem || grupo.variants.flatMap(v => v.imagens || [])[0] || ''
      }
    };
  });
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const args = process.argv.slice(2);
  const aplicar = args.includes('--apply');
  const estoqueArg = args.find(arg => arg.startsWith('--estoque-padrao='));
  const estoquePadrao = estoqueArg ? Number(estoqueArg.split('=')[1]) : null;
  if (estoquePadrao !== null && (!Number.isInteger(estoquePadrao) || estoquePadrao < 0)) throw new Error('Estoque padrão deve ser inteiro >= 0. Sem a opção, usa sob encomenda (null).');
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg) && !arg.startsWith('--estoque-padrao='))) throw new Error('Opção desconhecida. Use --dry-run ou --apply e, opcionalmente, --estoque-padrao=N.');
  if (aplicar && args.includes('--dry-run')) throw new Error('Escolha --apply ou --dry-run.');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI no Back/.env.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'catalogo', autoIndex: false, autoCreate: false });
  try {
    const produtos = await Produto.find().sort({ criadoEm: 1, _id: 1 }).lean();
    const plano = planejarMigracao(produtos, estoquePadrao);
    const skus = new Set();
    for (const grupo of agruparProdutos(produtos, { estoquePadrao, estrito: true })) {
      for (const variante of grupo.variants) {
        if (skus.has(variante.sku)) throw new Error(`SKU repetido: ${variante.sku}.`);
        skus.add(variante.sku);
      }
    }
    for (const item of plano) {
      await new Produto({ ...produtos.find(p => String(p._id) === String(item.id)), ...item.campos }).validate();
    }
    console.table(plano.map(p => ({ modelo: p.campos.nome, categoria: p.campos.categoria, variantes: p.campos.variants.length, documentosAgrupados: p.removerIds.length + 1 })));
    if (!aplicar || !plano.length) {
      console.log(!plano.length ? 'Nenhum produto pendente de migração.' : 'Simulação concluída. Nenhum documento alterado. Use --apply para aplicar.');
      return;
    }
    // Backup com todos os documentos antes de qualquer escrita; não inclui segredos.
    const pastaBackup = path.join(__dirname, '..', 'backups');
    await fs.mkdir(pastaBackup, { recursive: true });
    const arquivo = path.join(pastaBackup, `produtos-antes-variantes-${Date.now()}.json`);
    await fs.writeFile(arquivo, JSON.stringify(mongoose.mongo.BSON.EJSON.serialize(produtos), null, 2), { flag: 'wx' });
    const sessao = await mongoose.startSession();
    try {
      await sessao.withTransaction(async () => {
        // Confere o snapshot dentro da transação; não sobrescreve edições concorrentes.
        const atuais = await Produto.find().sort({ criadoEm: 1, _id: 1 }).session(sessao).lean();
        if (JSON.stringify(atuais) !== JSON.stringify(produtos)) throw new Error('O catálogo mudou após a leitura. Execute a simulação novamente.');
        for (const item of plano) {
          await Produto.updateOne({ _id: item.id }, { $set: item.campos }, { session: sessao, runValidators: true });
          if (item.removerIds.length) await Produto.deleteMany({ _id: { $in: item.removerIds } }).session(sessao);
        }
      });
    } finally { await sessao.endSession(); }
    console.log(`Migração concluída. Backup: ${arquivo}`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(erro => { console.error(erro.message); process.exitCode = 1; });

module.exports = { planejarMigracao };
