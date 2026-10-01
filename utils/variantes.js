const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const limpar = valor => String(valor || '').replace(/^[\s\-/|,]+|[\s\-/|,]+$/g, '').replace(/\s+/g, ' ').trim();
const CORES = [
  ['Light Gold', 'Dourado Claro'], ['Dourado Claro', 'Dourado Claro'], ['Verde Sage', 'Verde Sage'],
  ['Sage', 'Verde Sage'], ['Preto Jateado', 'Preto Jateado'], ['Cinza Espacial', 'Cinza Espacial'],
  ['Preto Espacial', 'Preto Espacial'], ['Luz Estelar', 'Estelar'], ['Meia-Noite', 'Meia-noite'],
  ['Azul Céu', 'Azul Céu'], ['Sky Blue', 'Azul Céu'], ['Azul Índigo', 'Azul Índigo'],
  ['Ouro Lunar', 'Ouro Lunar'], ['Branco/Turquesa', 'Branco/Turquesa'], ['Cinza Ardósia', 'Cinza Ardósia'],
  ['Cosmic Orange', 'Cosmic Orange'], ['Laranja Cósmico', 'Cosmic Orange'],
  ['Deep Blue', 'Deep Blue'], ['Azul Profundo', 'Deep Blue'],
  ['Natural Titanium', 'Titânio Natural'], ['Titânio Natural', 'Titânio Natural'],
  ['Desert Titanium', 'Titânio Deserto'], ['Titânio Deserto', 'Titânio Deserto'],
  ['Black Titanium', 'Titânio Preto'], ['Titânio Preto', 'Titânio Preto'],
  ['White Titanium', 'Titânio Branco'], ['Titânio Branco', 'Titânio Branco'],
  ['Blue Titanium', 'Titânio Azul'], ['Titânio Azul', 'Titânio Azul'],
  ['Space Black', 'Preto Espacial'], ['Space Gray', 'Cinza Espacial'],
  ['Midnight', 'Meia-noite'], ['Starlight', 'Estelar'], ['Rose Gold', 'Ouro Rosa'],
  ['Silver', 'Prata'], ['Prata', 'Prata'], ['Orange', 'Laranja'], ['Laranja', 'Laranja'],
  ['Black', 'Preto'], ['Preto', 'Preto'], ['White', 'Branco'], ['Branco', 'Branco'],
  ['Blue', 'Azul'], ['Azul', 'Azul'], ['Green', 'Verde'], ['Verde', 'Verde'],
  ['Pink', 'Rosa'], ['Rosa', 'Rosa'], ['Purple', 'Roxo'], ['Roxo', 'Roxo'],
  ['Gold', 'Dourado'], ['Dourado', 'Dourado'], ['Gray', 'Cinza'], ['Cinza', 'Cinza'],
  ['Red', 'Vermelho'], ['Vermelho', 'Vermelho'], ['Yellow', 'Amarelo'], ['Amarelo', 'Amarelo']
];

function identificarProduto(produto) {
  let nome = limpar(produto.nome);
  nome = limpar(nome.replace(/\b(CPO|lacrados?|seminovos?|recondicionados?)\b/gi, ''));
  const qualificador = nome.match(/\s+\(([^)]+)\)$/);
  if (qualificador) nome = limpar(nome.slice(0, qualificador.index));
  const capacidadeMatch = [...nome.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/gi)].at(-1);
  const tamanhoWatch = nome.match(/\b\d+\s*mm\b/i);
  const capacidade = produto.capacidade || (capacidadeMatch
    ? `${capacidadeMatch[1].replace(',', '.')}${capacidadeMatch[2].toUpperCase()}` : tamanhoWatch ? tamanhoWatch[0].replace(/\s/g, '').toLowerCase() : 'Padrão');
  // Só remove a última capacidade: preserva RAM em nomes como "8GB 256GB".
  if (capacidadeMatch) nome = limpar(nome.slice(0, capacidadeMatch.index) + nome.slice(capacidadeMatch.index + capacidadeMatch[0].length));
  else if (tamanhoWatch) nome = limpar(nome.replace(tamanhoWatch[0], ''));
  nome = limpar(nome.replace(/(\b\d+\s*GB)\s*\/(?=\s|$)/gi, '$1 '));
  let cor = produto.cor;
  for (const [alias, canonica] of CORES) {
    const nomeNormalizado = normalizar(nome);
    const corNormalizada = normalizar(alias);
    if (nomeNormalizado.endsWith(` ${corNormalizada}`) || nomeNormalizado.endsWith(`-${corNormalizada}`)) {
      nome = limpar(nome.slice(0, -alias.length));
      cor = cor || canonica;
      break;
    }
  }
  if (qualificador && !/nao ativado|sem lacre/.test(normalizar(qualificador[1]))) nome = `${nome} (${qualificador[1]})`;
  // Condição no nome não é parte do modelo, mas nunca misturamos Lacrado/CPO/Watch.
  const categoriaTexto = normalizar(`${produto.categoria} ${produto.nome}`);
  const categoria = /watch|garmin|fitbit|relogio/.test(categoriaTexto) ? 'Watch'
    : /\bcpo\b|seminovo|recondicionado/.test(categoriaTexto) ? 'CPO' : 'Lacrado';
  nome = limpar(nome.replace(/\b(CPO|lacrados?|seminovos?|recondicionados?)\b/gi, ''));
  const marca = produto.marca || (/iphone|ipad|apple|macbook|airpods|airtag/i.test(nome) ? 'Apple'
    : /xiaomi|redmi|poco/i.test(nome) ? 'Xiaomi'
    : /samsung|galaxy/i.test(nome) ? 'Samsung'
    : /garmin/i.test(nome) ? 'Garmin' : /fitbit/i.test(nome) ? 'Fitbit' : 'Outras');
  return { nome: produto.modelo || nome, marca, categoria, cor: cor || 'Padrão', capacidade };
}

function varianteLegada(produto, estoquePadrao = null) {
  const { cor, capacidade } = identificarProduto(produto);
  return {
    _id: produto._id,
    produtoLegadoId: produto._id,
    nomeLegado: produto.nome,
    mlId: produto.mlId,
    linkML: produto.linkML,
    cor, capacidade,
    preco: produto.precoPersonalizado || Number((Number(produto.preco) * 1.07 + 500).toFixed(2)),
    precoCusto: produto.preco,
    estoque: produto.disponivel === false ? 0 : (produto.estoque === undefined ? estoquePadrao : produto.estoque),
    disponivel: produto.disponivel !== false,
    sku: produto.sku || `PT-${produto._id}`,
    imagens: [...new Set([produto.imagem, ...(produto.galeria || [])].filter(Boolean))]
  };
}

const varianteDisponivel = v => v.disponivel !== false && (v.estoque === null || v.estoque === undefined || v.estoque > 0);

function resumirProduto(produto) {
  const variants = produto.variants || [];
  const disponiveis = variants.filter(varianteDisponivel);
  const precos = (disponiveis.length ? disponiveis : variants).map(v => Number(v.preco));
  return {
    ...produto,
    precoAPartir: precos.length ? Math.min(...precos) : produto.precoPersonalizado || produto.preco,
    cores: [...new Set(variants.map(v => v.cor))],
    capacidades: [...new Set(variants.map(v => v.capacidade))],
    sobEncomenda: disponiveis.some(v => v.estoque === null),
    disponivel: produto.disponivel !== false && disponiveis.length > 0
  };
}

function agruparProdutos(produtos, { estoquePadrao = null, estrito = false } = {}) {
  const grupos = new Map();
  for (const original of produtos) {
    const produto = original.toObject ? original.toObject() : original;
    const existente = produto.variants?.length > 0;
    const identidade = existente ? produto : identificarProduto(produto);
    const chave = [identidade.marca, identidade.categoria, identidade.nome].map(normalizar).join('|');
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        ...produto, nome: identidade.nome, marca: identidade.marca, categoria: identidade.categoria,
        categoriaOriginal: produto.categoriaOriginal || produto.categoria,
        variants: [], idsOriginais: [], conflitos: [], disponivel: false
      });
    }
    const grupo = grupos.get(chave);
    grupo.idsOriginais.push(produto._id);
    grupo.disponivel ||= produto.disponivel !== false;
    const variants = existente ? produto.variants : [varianteLegada(produto, estoquePadrao)];
    for (const variante of variants) {
      const duplicada = grupo.variants.find(v => normalizar(v.cor) === normalizar(variante.cor) && normalizar(v.capacidade) === normalizar(variante.capacidade));
      if (duplicada) {
        const mensagem = `${grupo.nome}: combinação repetida ${variante.cor}/${variante.capacidade} (${variante.sku}). Revise os documentos antes de migrar.`;
        if (estrito) throw new Error(mensagem);
        // Antes da migração, mantém todas as ofertas legadas sem esconder nenhuma.
        grupo.conflitos.push(mensagem);
      }
      grupo.variants.push(variante);
    }
  }
  return [...grupos.values()].map(resumirProduto);
}

function filtrarProdutos(produtos, filtros = {}) {
  return produtos.flatMap(produto => {
    if (!produto.disponivel) return [];
    if (['marca', 'categoria', 'modelo'].some(campo => filtros[campo] && normalizar(filtros[campo]) !== normalizar(campo === 'modelo' ? produto.nome : produto[campo]))) return [];
    const variants = produto.variants.filter(v => varianteDisponivel(v) &&
      (!filtros.cor || normalizar(v.cor) === normalizar(filtros.cor)) &&
      (!filtros.capacidade || normalizar(v.capacidade) === normalizar(filtros.capacidade)));
    if (!variants.length) return [];
    if (filtros.busca && !normalizar([produto.nome, produto.marca, produto.descricao, ...variants.map(v => `${v.cor} ${v.capacidade}`)].join(' ')).includes(normalizar(filtros.busca))) return [];
    return [resumirProduto({ ...produto, variants })];
  });
}

function listarFiltros(produtos, filtros = {}) {
  const unicos = valores => [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const nivel = campos => filtrarProdutos(produtos, Object.fromEntries(campos.map(campo => [campo, filtros[campo]])));
  return {
    marcas: unicos(nivel([]).map(p => p.marca)),
    categorias: unicos(nivel(['marca']).map(p => p.categoria)),
    modelos: unicos(nivel(['marca', 'categoria']).map(p => p.nome)),
    cores: unicos(nivel(['marca', 'categoria', 'modelo']).flatMap(p => p.variants.map(v => v.cor))),
    capacidades: unicos(nivel(['marca', 'categoria', 'modelo', 'cor']).flatMap(p => p.variants.map(v => v.capacidade)))
  };
}

module.exports = { identificarProduto, varianteLegada, varianteDisponivel, agruparProdutos, resumirProduto, filtrarProdutos, listarFiltros, normalizar };
