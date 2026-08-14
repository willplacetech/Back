const Pedido = require('../models/Pedido');

// ✅ CRIAR PEDIDO
exports.criar = async (req, res) => {
  try {
    // ✅ AGORA LÊ `dadosCliente` (nome correto que o frontend envia)
    const { itens, dadosCliente, total, status } = req.body;

    // ✅ Cria o pedido com os campos corretos
    const pedido = await Pedido.create({
      itens,
      dadosCliente,  // ✅ NOME CORRETO!
      total: total || itens.reduce((s, i) => s + (i.preco * i.quantidade), 0),
      status: status || 'pendente'
    });

    res.status(201).json({ sucesso: true, pedido });
  } catch (err) {
    console.error("❌ Erro ao criar pedido:", err);
    res.status(400).json({ sucesso: false, error: err.message });
  }
};

// ✅ LISTAR PEDIDOS
exports.listar = async (req, res) => {
  try {
    // ✅ AGORA ORDENA POR `criadoEm` (nome correto do Schema)
    const pedidos = await Pedido.find().sort({ criadoEm: -1 });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ ATUALIZAR STATUS
exports.atualizarStatus = async (req, res) => {
  try {
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json({ sucesso: true, pedido });
  } catch (err) {
    res.status(400).json({ sucesso: false, error: err.message });
  }
};