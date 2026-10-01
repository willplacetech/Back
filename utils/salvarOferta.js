const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { identificarProduto, varianteLegada, normalizar } = require('./variantes');

const chaveDoModelo = p => [p.marca, p.categoria, p.nome].map(normalizar).join('|');
const escaparRegex = texto => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function salvarOferta(dados, atualizarExistentes = true) {
  if (dados.variants?.length) {
    const identidade = { ...identificarProduto(dados), nome: dados.nome };
    return Produto.create({ ...dados, marca: identidade.marca, categoria: identidade.categoria, chaveModelo: chaveDoModelo(identidade) });
  }
  // Antes da migração, preserva a atualização dos cadastros antigos por nome.
  const legado = await Produto.findOne({ nome: { $regex: `^${escaparRegex(dados.nome)}$`, $options: 'i' }, 'variants.0': { $exists: false } });
  if (legado) {
    if (!atualizarExistentes) throw new Error('Produto já cadastrado.');
    return Produto.findByIdAndUpdate(legado._id, { $set: dados }, { new: true, runValidators: true });
  }
  const identidade = identificarProduto(dados);
  const chaveModelo = chaveDoModelo(identidade);
  const nova = varianteLegada({ ...dados, _id: new mongoose.Types.ObjectId() });
  const camposModelo = {
    chaveModelo, nome: identidade.nome, marca: identidade.marca, categoria: identidade.categoria,
    categoriaOriginal: dados.categoria, descricao: dados.descricao || '', imagem: dados.imagem || '',
    ...(dados.mlId ? { mlId: dados.mlId, linkML: dados.linkML, galeria: dados.galeria } : {}),
    preco: dados.preco, disponivel: true, specs: dados.specs || {}, variants: [nova]
  };
  // Valida antes de escrever e insere o modelo já com a primeira variante.
  await new Produto(camposModelo).validate();
  let produto;
  try {
    produto = await Produto.findOneAndUpdate({ chaveModelo }, { $setOnInsert: camposModelo }, { upsert: true, new: true, runValidators: true });
  } catch (erro) {
    // Duas importações simultâneas podem tentar criar o mesmo modelo.
    if (erro.code !== 11000) throw erro;
    produto = await Produto.findOne({ chaveModelo });
    if (!produto) throw erro;
  }
  const existente = produto.variants.find(v => normalizar(v.cor) === normalizar(identidade.cor) && normalizar(v.capacidade) === normalizar(identidade.capacidade));
  if (existente && String(existente._id) === String(nova._id)) return produto;
  if (existente) {
    if (!atualizarExistentes) throw new Error('Cor e capacidade já cadastradas neste modelo.');
    const campos = { 'variants.$.preco': nova.preco, 'variants.$.precoCusto': dados.preco };
    if (dados.imagem) campos['variants.$.imagens'] = nova.imagens;
    if (dados.estoque !== undefined) campos['variants.$.estoque'] = dados.estoque;
    if (dados.disponivel !== undefined) campos['variants.$.disponivel'] = dados.disponivel;
    return Produto.findOneAndUpdate({ _id: produto._id, 'variants._id': existente._id }, { $set: campos }, { new: true, runValidators: true });
  }
  const validacao = new Produto({ ...produto.toObject(), variants: [...produto.variants.map(v => v.toObject()), nova] });
  await validacao.validate();
  const atualizado = await Produto.findOneAndUpdate({ _id: produto._id, variants: { $not: { $elemMatch: { cor: nova.cor, capacidade: nova.capacidade } } } }, { $push: { variants: nova } }, { new: true, runValidators: true });
  if (!atualizado) {
    if (!atualizarExistentes) throw new Error('Cor e capacidade já cadastradas neste modelo.');
    return salvarOferta(dados, atualizarExistentes);
  }
  return atualizado;
}

module.exports = { salvarOferta, chaveDoModelo };
