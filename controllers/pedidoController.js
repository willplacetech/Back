const Pedido = require('../models/Pedido');
const Produto = require('../models/Produto');
const { validarItensPedido } = require('../utils/itensPedido');
const { carregarAcessivel } = require('./tradeInController');

// ✅ CRIAR PEDIDO
exports.criar = async (req, res) => {
  try {
    const { itens, dadosCliente } = req.body;

    if (!Array.isArray(itens) || itens.length === 0 || !dadosCliente?.nome || !dadosCliente?.telefone) {
      return res.status(400).json({ sucesso: false, error: 'Itens, nome e telefone são obrigatórios' });
    }

    const itensValidados = validarItensPedido(await Produto.find().lean(), itens);
    const totalCalculado = itensValidados.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
    let troca = null;
    let valorTroca = 0;
    if (req.body.tradeInId) {
      troca = await carregarAcessivel(req, req.body.tradeInId);
      if (['rejeitado', 'concluido'].includes(troca.status)) {
        return res.status(400).json({ sucesso: false, error: 'Esta troca não está disponível para um novo pedido.' });
      }
      if (await Pedido.exists({ tradeInId: troca._id, status: { $in: ['pendente', 'confirmado', 'entregue'] } })) {
        return res.status(409).json({ sucesso: false, error: 'Esta troca já está associada a outro pedido ativo.' });
      }
      if (troca.status === 'aprovado' && Number.isFinite(troca.valorOferta)) {
        valorTroca = Math.min(totalCalculado, Math.max(0, troca.valorOferta));
      }
    }

    const pedido = await Pedido.create({
      itens: itensValidados,
      tradeInId: troca?._id || null,
      valorTroca: Number(valorTroca.toFixed(2)),
      dadosCliente: {
        nome: dadosCliente.nome.trim(),
        telefone: dadosCliente.telefone.trim(),
        endereco: String(dadosCliente.endereco || '').trim()
      },
      total: Number((totalCalculado - valorTroca).toFixed(2)),
      status: 'pendente'
    });

    res.status(201).json({ sucesso: true, pedido });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ sucesso: false, error: 'Esta troca já está associada a outro pedido ativo.' });
    console.error("❌ Erro ao criar pedido:", err);
    res.status(err.status || 400).json({ sucesso: false, error: err.message });
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
    if (err.code === 11000) return res.status(409).json({ sucesso: false, error: 'Esta troca já está associada a outro pedido ativo.' });
    res.status(400).json({ sucesso: false, error: err.message });
  }
};
