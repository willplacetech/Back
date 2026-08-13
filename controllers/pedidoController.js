const Pedido = require('../models/Pedido');

exports.criar = async (req, res) => {
  try {
    const { itens, cliente } = req.body;
    const total = itens.reduce((s, i) => s + (i.preco * i.quantidade), 0);
    const pedido = await Pedido.create({ itens, cliente, total });
    res.status(201).json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listar = async (req, res) => {
  try {
    const pedidos = await Pedido.find().sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
