const Produto = require('../models/Produto');

// ✅ CRIAR PRODUTO
exports.criar = async (req, res) => {
  try {
    const body = req.body;
    if (!body.nome || !body.nome.trim()) {
      return res.status(400).json({ sucesso: false, error: 'Nome do produto é obrigatório!' });
    }

    const produto = await Produto.create({
      nome: body.nome.trim(),
      descricao: body.descricao || '',
      preco: Number(body.preco) || 0,
      precoPersonalizado: body.precoPersonalizado ? Number(body.precoPersonalizado) : undefined,
      categoria: body.categoria || '',
      imagem: body.imagem || '',
      disponivel: body.disponivel !== undefined ? body.disponivel : true
    });

    res.status(201).json({ sucesso: true, produto });
  } catch (err) {
    console.error("❌ Erro ao criar produto:", err);
    res.status(400).json({ sucesso: false, error: err.message });
  }
};

// ✅ LISTAR TODOS OS PRODUTOS
exports.listar = async (req, res) => {
  try {
    const produtos = await Produto.find().sort({ criadoEm: -1 });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ LISTAR SÓ DISPONÍVEIS (para o catálogo)
exports.listarDisponiveis = async (req, res) => {
  try {
    const produtos = await Produto.find({ disponivel: true });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ BUSCAR POR ID (NOVA!)
exports.buscarPorId = async (req, res) => {
  try {
    const produto = await Produto.findById(req.params.id);
    if (!produto) {
      return res.status(404).json({ sucesso: false, error: 'Produto não encontrado' });
    }
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ BUSCAR POR CATEGORIA (NOVA!)
exports.buscarPorCategoria = async (req, res) => {
  try {
    const produtos = await Produto.find({ 
      categoria: req.params.categoria,
      disponivel: true 
    });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ ATUALIZAR PRODUTO
exports.atualizar = async (req, res) => {
  try {
    const body = req.body;
    const dadosAtualizar = {};

    if (body.nome) dadosAtualizar.nome = body.nome.trim();
    if (body.descricao !== undefined) dadosAtualizar.descricao = body.descricao;
    if (body.preco) dadosAtualizar.preco = Number(body.preco);
    if (body.precoPersonalizado !== undefined) {
      dadosAtualizar.precoPersonalizado = body.precoPersonalizado ? Number(body.precoPersonalizado) : undefined;
    }
    if (body.categoria !== undefined) dadosAtualizar.categoria = body.categoria;
    if (body.imagem !== undefined) dadosAtualizar.imagem = body.imagem;
    if (body.disponivel !== undefined) dadosAtualizar.disponivel = body.disponivel;

    const produto = await Produto.findByIdAndUpdate(
      req.params.id,
      dadosAtualizar,
      { new: true, runValidators: true }
    );

    if (!produto) {
      return res.status(404).json({ sucesso: false, error: 'Produto não encontrado' });
    }

    res.json({ sucesso: true, produto });
  } catch (err) {
    console.error("❌ Erro ao atualizar produto:", err);
    res.status(400).json({ sucesso: false, error: err.message });
  }
};

// ✅ EXCLUIR PRODUTO
exports.excluir = async (req, res) => {
  try {
    const produto = await Produto.findByIdAndDelete(req.params.id);
    
    if (!produto) {
      return res.status(404).json({ sucesso: false, error: 'Produto não encontrado' });
    }

    res.json({ sucesso: true, mensagem: 'Produto excluído com sucesso!' });
  } catch (err) {
    console.error("❌ Erro ao excluir produto:", err);
    res.status(500).json({ sucesso: false, error: err.message });
  }
};