// MODELO DO PEDIDO — confira se tem isso
const PedidoSchema = new mongoose.Schema({
  itens: [{
    nome: String,
    preco: Number,
    quantidade: Number,
    imagem: String
  }],
  total: Number,
  dadosCliente: {
    nome: String,
    telefone: String,
    endereco: String
  },
  status: { type: String, default: 'pendente' },
  criadoEm: { type: Date, default: Date.now }
});
const Pedido = mongoose.model('Pedido', PedidoSchema);

// ✅ ROTA DE CRIAR PEDIDO
app.post('/api/pedidos', async (req, res) => {
  try {
    const pedido = new Pedido(req.body);
    await pedido.save(); // ⚠️ ESSA LINHA SALVA NO BANCO
    res.status(201).json({ sucesso: true, pedido });
  } catch (erro) {
    console.error("❌ Erro ao salvar pedido:", erro); // ✅ Vai aparecer no log
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});