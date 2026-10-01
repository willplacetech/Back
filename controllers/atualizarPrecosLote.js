const { normalizarPreco } = require('../utils/precoUtils');

module.exports = (Produto) => async (req, res) => {
  const { produtos } = req.body;
  if (!Array.isArray(produtos) || !produtos.length) {
    return res.status(400).json({ error: 'Informe uma lista de produtos.' });
  }
  const resultados = { sucesso: [], ignorados: [], erros: [], total: produtos.length };
  const nomes = new Set();
  for (const [indice, item] of produtos.entries()) {
    const nome = typeof item?.nome === 'string' ? item.nome.trim() : '';
    try {
      const preco = normalizarPreco(item?.preco);
      const temVenda = item?.precoPersonalizado !== undefined && item.precoPersonalizado !== null && item.precoPersonalizado !== '';
      const precoPersonalizado = temVenda ? normalizarPreco(item.precoPersonalizado) : undefined;
      if (!nome || !Number.isFinite(preco) || preco <= 0 || (temVenda && (!Number.isFinite(precoPersonalizado) || precoPersonalizado <= 0))) {
        throw new Error('Nome e preços válidos são obrigatórios.');
      }
      const chave = nome.toLowerCase();
      if (nomes.has(chave)) throw new Error('Nome repetido na lista; revise o preço deste item.');
      nomes.add(chave);
      const regex = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const encontrados = await Produto.find({ nome: { $regex: `^${regex}$`, $options: 'i' } }).limit(2);
      if (!encontrados.length) {
        resultados.ignorados.push({ indice, nome, motivo: 'Produto não cadastrado' });
        continue;
      }
      if (encontrados.length > 1) throw new Error('Há mais de um produto com este nome no cadastro.');
      const campos = { preco, ...(temVenda ? { precoPersonalizado } : {}) };
      const atualizado = await Produto.findByIdAndUpdate(encontrados[0]._id, { $set: campos }, { new: true, runValidators: true });
      if (!atualizado) throw new Error('Produto não está mais cadastrado.');
      resultados.sucesso.push({ indice, nome: atualizado.nome, id: atualizado._id, acao: 'atualizado' });
    } catch (erro) {
      resultados.erros.push({ indice, nome, erro: erro.message });
    }
  }
  return res.json({ sucesso: resultados.erros.length === 0, resultados });
};
