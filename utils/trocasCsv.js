function celula(valor) {
  let texto = String(valor ?? '');
  // Impede fórmulas ao abrir campos fornecidos pelo cliente em uma planilha.
  if (/^[\s]*[=+\-@]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

function trocasCsv(trocas) {
  const linhas = [['Protocolo', 'Data (UTC)', 'Nome', 'Email', 'Telefone', 'Modelo', 'Capacidade', 'Cor', 'IMEI', 'Status', 'Valor oferta (R$)', 'Motivo rejeição']];
  for (const t of trocas) linhas.push([
    t._id, t.createdAt ? new Date(t.createdAt).toISOString() : '', t.nome, t.email, t.telefone,
    t.modeloAparelho, t.capacidade, t.cor, t.imei, t.status,
    t.valorOferta === null || t.valorOferta === undefined ? '' : Number(t.valorOferta).toFixed(2).replace('.', ','), t.motivoRejeicao
  ]);
  return '\ufeff' + linhas.map(linha => linha.map(celula).join(';')).join('\r\n') + '\r\n';
}
module.exports = { trocasCsv };
