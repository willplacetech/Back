const Pedido = require('../models/Pedido');
const Produto = require('../models/Produto');

// ✅ CRIAR PEDIDO
exports.criar = async (req, res) => {
  try {
    const { itens, dadosCliente } = req.body;

    if (!Array.isArray(itens) || itens.length === 0 || !dadosCliente?.nome || !dadosCliente?.telefone) {
      return res.status(400).json({ sucesso: false, error: 'Itens, nome e telefone são obrigatórios' });
    }

    const quantidades = new Map();
    for (const item of itens) {
      if (!item.produtoId || !Number.isInteger(item.quantidade) || item.quantidade < 1) {
        return res.status(400).json({ sucesso: false, error: 'Item ou quantidade inválida' });
      }
      quantidades.set(String(item.produtoId), (quantidades.get(String(item.produtoId)) || 0) + item.quantidade);
    }

    const produtos = await Produto.find({
      _id: { $in: [...quantidades.keys()] },
      disponivel: true
    }).lean();
    if (produtos.length !== quantidades.size) {
      return res.status(400).json({ sucesso: false, error: 'Um ou mais produtos não estão disponíveis' });
    }

    const itensValidados = produtos.map(produto => {
      const preco = produto.precoPersonalizado || produto.preco;
      return {
        produtoId: produto._id,
        nome: produto.nome,
        preco,
        quantidade: quantidades.get(String(produto._id)),
        imagem: produto.imagem || ''
      };
    });
    const totalCalculado = itensValidados.reduce((soma, item) => soma + item.preco * item.quantidade, 0);

    const pedido = await Pedido.create({
      itens: itensValidados,
      dadosCliente: {
        nome: dadosCliente.nome.trim(),
        telefone: dadosCliente.telefone.trim(),
        endereco: String(dadosCliente.endereco || '').trim()
      },
      total: Number(totalCalculado.toFixed(2)),
      status: 'pendente'
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
    const statusPermitidos = ['pendente', 'confirmado', 'entregue', 'cancelado'];
    if (!statusPermitidos.includes(req.body.status)) {
      return res.status(400).json({ sucesso: false, error: 'Status inválido' });
    }
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!pedido) return res.status(404).json({ sucesso: false, error: 'Pedido não encontrado' });
    res.json({ sucesso: true, pedido });
  } catch (err) {
    res.status(400).json({ sucesso: false, error: err.message });
  }
};