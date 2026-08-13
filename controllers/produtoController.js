const Produto = require('../models/Produto');

const limparParaCliente = (produto) => {
  const obj = produto.toObject();
  delete obj.mlId;
  delete obj.linkML;
  delete obj.obsInterna;
  delete obj.__v;
  return obj;
};

exports.listar = async (req, res) => {
  try {
    const produtos = await Produto.find().sort({ createdAt: -1 });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listarDisponiveis = async (req, res) => {
  try {
    const produtos = await Produto.find({ disponivel: true });
    res.json(produtos.map(limparParaCliente));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.criar = async (req, res) => {
  try {
    const produto = await Produto.create(req.body);
    res.status(201).json(produto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const produto = await Produto.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(produto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deletar = async (req, res) => {
  try {
    await Produto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.relatorio = async (req, res) => {
  try {
    const total = await Produto.countDocuments();
    const indisponiveis = await Produto.countDocuments({ disponivel: false });
    const importadosML = await Produto.countDocuments({ mlId: { $exists: true } });
    res.json({
      totalProdutos: total,
      indisponiveis,
      importadosML
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};