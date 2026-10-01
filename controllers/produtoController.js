const Produto = require('../models/Produto');
const { buscarImagemProduto } = require('../utils/imagemSearch');
const { normalizarPreco } = require('../utils/precoUtils');
const { agruparProdutos, filtrarProdutos, listarFiltros, resumirProduto } = require('../utils/variantes');
const { salvarOferta, chaveDoModelo } = require('../utils/salvarOferta');

const urlImagemDireta = (valor) => {
  try {
    const url = new URL(String(valor || '').trim());
    return ['http:', 'https:'].includes(url.protocol) && /\.(jpg|jpeg|png|webp|gif)(?:$|\?)/i.test(url.pathname + url.search)
      ? url.toString()
      : '';
  } catch {
    return '';
  }
};

const obterImagemProduto = async (nome, informada) => {
  const imagemValida = urlImagemDireta(informada);
  if (imagemValida) return imagemValida;
  return await buscarImagemProduto(nome, {
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
    pixabayKey: process.env.PIXABAY_API_KEY,
    tentarBing: true
  }) || '';
};

// ✅ CRIAR PRODUTO
exports.criar = async (req, res) => {
  try {
    const body = req.body;
    const preco = Array.isArray(body.variants) && body.variants.length
      ? Math.min(...body.variants.map(v => Number(v.precoCusto || v.preco))) : normalizarPreco(body.preco);
    const precoPersonalizado = body.precoPersonalizado === undefined || body.precoPersonalizado === ''
      ? undefined
      : normalizarPreco(body.precoPersonalizado);

    if (!body.nome || !body.nome.trim() || !Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({ sucesso: false, error: 'Nome do produto é obrigatório!' });
    }
    if (precoPersonalizado !== undefined && (!Number.isFinite(precoPersonalizado) || precoPersonalizado <= 0)) {
      return res.status(400).json({ sucesso: false, error: 'Preço personalizado inválido' });
    }

    const imagem = await obterImagemProduto(body.nome.trim(), body.imagem || body.variants?.flatMap(v => v.imagens || [])[0]);

    const produto = await salvarOferta({
      nome: body.nome.trim(),
      descricao: body.descricao || '',
      preco,
      precoPersonalizado,
      categoria: body.categoria || '',
      imagem,
      disponivel: body.disponivel !== undefined ? body.disponivel : true,
      marca: body.marca || '',
      cor: body.cor,
      capacidade: body.capacidade,
      estoque: body.estoque,
      sku: body.sku,
      specs: body.specs || {},
      variants: body.variants || []
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
    const produtos = await Produto.find().sort({ criadoEm: -1 }).lean();
    res.json(filtrarProdutos(agruparProdutos(produtos), req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mantém a lista administrativa completa, inclusive modelos indisponíveis.
exports.listarAdministracao = async (req, res) => {
  try {
    const produtos = await Produto.find().sort({ criadoEm: -1 }).lean();
    res.json(produtos.map(p => p.variants?.length ? { ...p, precoPersonalizado: resumirProduto(p).precoAPartir,
      preco: Math.min(...p.variants.map(v => v.precoCusto || v.preco)) } : p));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.filtros = async (req, res) => {
  try { res.json(listarFiltros(agruparProdutos(await Produto.find().lean()), req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// ✅ LISTAR SÓ DISPONÍVEIS (para o catálogo)
exports.listarDisponiveis = async (req, res) => {
  try {
    const produtos = await Produto.find().lean();
    res.json(filtrarProdutos(agruparProdutos(produtos), req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ BUSCAR POR ID (NOVA!)
exports.buscarPorId = async (req, res) => {
  try {
    const produtos = agruparProdutos(await Produto.find().lean());
    const produto = produtos.find(p => String(p._id) === req.params.id || p.idsOriginais.some(id => String(id) === req.params.id) || p.variants.some(v => String(v.produtoLegadoId) === req.params.id));
    if (!produto) {
      return res.status(404).json({ sucesso: false, error: 'Produto não encontrado' });
    }
    if (!produto.disponivel) return res.status(404).json({ sucesso: false, error: 'Produto indisponível' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ BUSCAR POR CATEGORIA (NOVA!)
exports.buscarPorCategoria = async (req, res) => {
  try {
    const produtos = agruparProdutos(await Produto.find().lean());
    res.json(filtrarProdutos(produtos, { ...req.query, categoria: req.params.categoria }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ ATUALIZAR PRODUTO
exports.atualizar = async (req, res) => {
  try {
    const body = req.body;
    const dadosAtualizar = {};
    const atual = await Produto.findById(req.params.id);
    if (!atual) return res.status(404).json({ sucesso: false, error: 'Produto não encontrado' });
    if (atual.variants.length && !body.variants && (body.preco !== undefined || body.precoPersonalizado !== undefined)) {
      return res.status(400).json({ sucesso: false, error: 'Este modelo tem variantes. Edite o preço de cada variante.' });
    }
    if (body.variants !== undefined) {
      if (!Array.isArray(body.variants) || !body.variants.length) return res.status(400).json({ sucesso: false, error: 'Informe ao menos uma variante.' });
      dadosAtualizar.variants = body.variants;
      dadosAtualizar.preco = Math.min(...body.variants.map(v => Number(v.precoCusto || v.preco)));
      dadosAtualizar.precoPersonalizado = Math.min(...body.variants.map(v => Number(v.preco)));
    }
    if (body.marca !== undefined) dadosAtualizar.marca = body.marca;
    if (body.specs !== undefined) dadosAtualizar.specs = body.specs;

    if (body.nome !== undefined) {
      if (!body.nome.trim()) return res.status(400).json({ sucesso: false, error: 'Nome inválido' });
      dadosAtualizar.nome = body.nome.trim();
    }
    if (body.descricao !== undefined) dadosAtualizar.descricao = body.descricao;
    if (body.preco !== undefined && !body.variants) {
      const preco = Number(body.preco);
      if (!Number.isFinite(preco) || preco <= 0) {
        return res.status(400).json({ sucesso: false, error: 'Preço inválido' });
      }
      dadosAtualizar.preco = preco;
    }
    if (body.precoPersonalizado !== undefined && !body.variants) {
      if (body.precoPersonalizado === '' || body.precoPersonalizado === null) {
        dadosAtualizar.$unset = { precoPersonalizado: 1 };
      } else {
        const precoPersonalizado = Number(body.precoPersonalizado);
        if (!Number.isFinite(precoPersonalizado) || precoPersonalizado <= 0) {
          return res.status(400).json({ sucesso: false, error: 'Preço personalizado inválido' });
        }
        dadosAtualizar.precoPersonalizado = precoPersonalizado;
      }
    }
    if (body.categoria !== undefined) dadosAtualizar.categoria = body.categoria;
    if (body.imagem !== undefined) dadosAtualizar.imagem = body.imagem;
    if (body.disponivel !== undefined) dadosAtualizar.disponivel = body.disponivel;
    if (atual.variants.length || body.variants?.length) dadosAtualizar.chaveModelo = chaveDoModelo({ ...atual.toObject(), ...dadosAtualizar });

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

exports.atualizarVariante = async (req, res) => {
  try {
    const produto = await Produto.findById(req.params.id);
    const variante = produto?.variants.id(req.params.variantId);
    if (!variante) return res.status(404).json({ sucesso: false, error: 'Variante não encontrada' });
    for (const campo of ['cor', 'capacidade', 'preco', 'precoCusto', 'estoque', 'sku', 'imagens', 'disponivel']) {
      if (req.body[campo] !== undefined) variante[campo] = req.body[campo];
    }
    const resumo = resumirProduto(produto.toObject());
    produto.precoPersonalizado = resumo.precoAPartir;
    await produto.save();
    res.json({ sucesso: true, produto });
  } catch (err) { res.status(400).json({ sucesso: false, error: err.message }); }
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

exports.relatorio = async (req, res) => {
  try {
    const produtos = agruparProdutos(await Produto.find().lean());
    const totalProdutos = produtos.length;
    const disponiveis = produtos.filter(p => p.disponivel).length;
    const importadosML = produtos.filter(p => p.mlId || p.variants.some(v => v.mlId)).length;
    return res.json({ totalProdutos, disponiveis, indisponiveis: totalProdutos - disponiveis, importadosML });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
};

// ✅ IMPORTAR PRODUTOS EM LOTE
exports.importarLote = async (req, res) => {
  try {
    const { produtos } = req.body;

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ sucesso: false, error: 'Array de produtos é obrigatório' });
    }

    const resultados = {
      sucesso: [],
      erros: [],
      total: produtos.length
    };

    // Processa cada produto
    for (let i = 0; i < produtos.length; i++) {
      try {
        const p = produtos[i];
        const preco = normalizarPreco(p.preco);
        const precoPersonalizado = p.precoPersonalizado ? normalizarPreco(p.precoPersonalizado) : undefined;

        // Validações
        if (!p.nome || !p.nome.trim() || !Number.isFinite(preco) || preco <= 0) {
          resultados.erros.push({
            indice: i,
            nome: p.nome || 'Sem nome',
            erro: 'Nome e preço são obrigatórios'
          });
          continue;
        }

        // Cria o produto
        const produto = await salvarOferta({
          nome: p.nome.trim(),
          descricao: p.descricao || '',
          preco,
          precoPersonalizado,
          categoria: p.categoria || 'Importado',
          imagem: p.imagem || '',
          disponivel: p.disponivel !== false
        });

        resultados.sucesso.push({
          indice: i,
          nome: produto.nome,
          id: produto._id
        });

      } catch (err) {
        resultados.erros.push({
          indice: i,
          nome: produtos[i].nome || 'Sem nome',
          erro: err.message
        });
      }
    }

    res.status(201).json({
      sucesso: resultados.erros.length === 0,
      resultados,
      resumo: `${resultados.sucesso.length}/${resultados.total} produtos importados com sucesso`
    });

  } catch (err) {
    console.error("❌ Erro ao importar lote:", err);
    res.status(400).json({ sucesso: false, error: err.message });
  }
};
