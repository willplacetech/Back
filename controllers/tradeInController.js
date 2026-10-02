const crypto = require('crypto');
const mongoose = require('mongoose');
const TradeIn = require('../models/TradeIn');
const { isAdmin } = require('../middleware/auth');
const cloudinaryTroca = require('../utils/cloudinaryTroca');

const STATUS = ['pendente', 'em_avaliacao', 'aprovado', 'rejeitado', 'concluido'];
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function erroHttp(status, message) { return Object.assign(new Error(message), { status }); }

function podeConsultar(solicitacao, req) {
  if (isAdmin(req.auth)) return true;
  if (req.user && solicitacao.userId && String(solicitacao.userId) === String(req.user._id)) return true;
  if (solicitacao.userId) return false;
  const token = req.get('X-Troca-Token');
  if (!token || !solicitacao.acessoTokenHash) return false;
  const recebido = Buffer.from(hashToken(token));
  const salvo = Buffer.from(solicitacao.acessoTokenHash);
  return recebido.length === salvo.length && crypto.timingSafeEqual(recebido, salvo);
}

async function carregarAcessivel(req, id = req.params.id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw erroHttp(400, 'ID de solicitação inválido');
  const solicitacao = await TradeIn.findById(id).select('+acessoTokenHash');
  if (!solicitacao || !podeConsultar(solicitacao, req)) throw erroHttp(404, 'Solicitação não encontrada');
  return solicitacao;
}

function responderErro(res, erro) {
  if (erro.code === 11000) return res.status(409).json({ sucesso: false, error: 'Já existe uma solicitação para este IMEI' });
  if (erro.name === 'ValidationError' || erro.name === 'CastError') {
    return res.status(400).json({ sucesso: false, error: erro.message });
  }
  return res.status(erro.status || 500).json({ sucesso: false, error: erro.status ? erro.message : 'Não foi possível processar a solicitação de troca' });
}

exports.criar = async (req, res) => {
  let salvo = false;
  let assets = [];
  try {
    const body = req.body || {};
    const acessoToken = req.user ? null : crypto.randomBytes(32).toString('hex');
    const id = new mongoose.Types.ObjectId();
    const solicitacao = new TradeIn({
      _id: id,
      userId: req.user?._id || null,
      nome: body.nome || req.user?.nome,
      email: body.email || req.user?.email,
      telefone: body.telefone || req.user?.telefone,
      modeloAparelho: body.modeloAparelho,
      capacidade: body.capacidade,
      cor: body.cor,
      imei: body.imei,
      descricaoEstado: body.descricaoEstado,
      ...(acessoToken ? { acessoTokenHash: hashToken(acessoToken) } : {})
    });
    // Valida os campos antes de gastar uploads; as fotos são validadas no save.
    await solicitacao.validate(['userId', 'nome', 'email', 'telefone', 'modeloAparelho', 'capacidade', 'cor', 'imei', 'descricaoEstado']);
    if (await TradeIn.exists({ imei: solicitacao.imei })) throw erroHttp(409, 'Já existe uma solicitação para este IMEI');
    if (req.aborted) throw erroHttp(400, 'Envio interrompido');
    const enviado = await cloudinaryTroca.subirFotos(req.files, id);
    assets = enviado.assets;
    solicitacao.fotos = enviado.fotos;
    solicitacao.cloudinaryAssets = assets;
    if (req.aborted || res.destroyed) throw erroHttp(400, 'Envio interrompido');
    await solicitacao.save();
    salvo = true;
    res.status(201).json({ sucesso: true, id: solicitacao._id, protocolo: String(solicitacao._id), status: solicitacao.status, ...(acessoToken ? { acessoToken } : {}) });
  } catch (erro) {
    if (!salvo && assets.length) await cloudinaryTroca.excluirFotos(assets);
    responderErro(res, erro);
  }
};

exports.listarMinhas = async (req, res) => {
  try {
    const solicitacoes = await TradeIn.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(solicitacoes);
  } catch (erro) { responderErro(res, erro); }
};

exports.listarAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !STATUS.includes(status)) throw erroHttp(400, 'Status inválido');
    res.json(await TradeIn.find(status ? { status } : {}).sort({ createdAt: -1 }));
  } catch (erro) { responderErro(res, erro); }
};

exports.buscarPorId = async (req, res) => {
  try {
    const solicitacao = await carregarAcessivel(req);
    const dados = solicitacao.toObject();
    delete dados.acessoTokenHash;
    delete dados.cloudinaryAssets;
    res.json(dados);
  } catch (erro) { responderErro(res, erro); }
};

exports.atualizarStatus = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw erroHttp(400, 'ID de solicitação inválido');
    const { status, valorOferta, motivoRejeicao } = req.body || {};
    if (!STATUS.includes(status)) throw erroHttp(400, 'Status inválido');
    const campos = { status };
    if (valorOferta !== undefined) {
      if (typeof valorOferta !== 'number' || !Number.isFinite(valorOferta) || valorOferta < 0) throw erroHttp(400, 'Valor de oferta deve ser um número maior ou igual a zero');
      campos.valorOferta = valorOferta;
    }
    if (motivoRejeicao !== undefined) {
      if (typeof motivoRejeicao !== 'string' || motivoRejeicao.length > 2000) throw erroHttp(400, 'Motivo de rejeição inválido');
      campos.motivoRejeicao = motivoRejeicao.trim();
    }
    if (status === 'aprovado' && valorOferta === undefined) throw erroHttp(400, 'Informe valorOferta para aprovar a solicitação');
    if (status === 'rejeitado' && !campos.motivoRejeicao) throw erroHttp(400, 'Informe motivoRejeicao para rejeitar a solicitação');
    if (status === 'aprovado') campos.motivoRejeicao = '';
    if (status === 'rejeitado') campos.valorOferta = null;
    const solicitacao = await TradeIn.findByIdAndUpdate(req.params.id, { $set: campos }, { new: true, runValidators: true });
    if (!solicitacao) throw erroHttp(404, 'Solicitação não encontrada');
    res.json({ sucesso: true, solicitacao });
  } catch (erro) { responderErro(res, erro); }
};

exports.carregarAcessivel = carregarAcessivel;
exports.responderErro = responderErro;
