const { agruparProdutos, varianteDisponivel } = require('./variantes');

function validarItensPedido(produtos, itens) {
  const agrupados = agruparProdutos(produtos);
  const validados = new Map();
  for (const item of itens) {
    if (!item?.produtoId || !Number.isInteger(item.quantidade) || item.quantidade < 1) throw new Error('Item ou quantidade inválida');
    const id = String(item.produtoId);
    const produto = agrupados.find(p => String(p._id) === id || p.idsOriginais.some(origem => String(origem) === id) || p.variants.some(v => String(v.produtoLegadoId) === id));
    if (!produto?.disponivel) throw new Error('Um ou mais produtos não estão disponíveis');
    const variante = item.variantId
      ? produto.variants.find(v => String(v._id) === String(item.variantId))
      : produto.variants.find(v => String(v.produtoLegadoId) === id) || (produto.variants.length === 1 ? produto.variants[0] : null);
    if (!variante || !varianteDisponivel(variante)) throw new Error('Selecione uma variante disponível');
    if (item.sku && item.sku !== variante.sku) throw new Error('SKU não corresponde à variante selecionada');
    const chave = `${produto._id}:${variante._id}`;
    const quantidade = (validados.get(chave)?.quantidade || 0) + item.quantidade;
    if (variante.estoque !== null && variante.estoque !== undefined && quantidade > variante.estoque) throw new Error(`Quantidade indisponível para ${produto.nome} ${variante.cor} ${variante.capacidade}`);
    validados.set(chave, {
      produtoId: produto._id, variantId: variante._id, sku: variante.sku,
      cor: variante.cor, capacidade: variante.capacidade,
      nome: [produto.nome, variante.cor !== 'Padrão' ? variante.cor : '', variante.capacidade !== 'Padrão' ? variante.capacidade : ''].filter(Boolean).join(' '),
      preco: variante.preco, quantidade,
      imagem: variante.imagens?.[0] || produto.imagem || ''
    });
  }
  return [...validados.values()];
}

module.exports = { validarItensPedido };
