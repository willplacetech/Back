function normalizarPreco(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;

  const entrada = String(valor).trim();
  if (!entrada) return 0;

  const semSimbolos = entrada.replace(/[^0-9,.-]/g, '');
  if (!semSimbolos || semSimbolos === '-' || semSimbolos === '.' || semSimbolos === ',') return 0;

  let sinal = 1;
  let numero = semSimbolos;
  if (numero.startsWith('-')) {
    sinal = -1;
    numero = numero.slice(1);
  }

  const temVirgula = numero.includes(',');
  const temPonto = numero.includes('.');

  let valorNumerico;

  if (temVirgula && temPonto) {
    valorNumerico = Number(numero.replace(/\./g, '').replace(',', '.'));
  } else if (temVirgula) {
    const partes = numero.split(',');
    if (partes.length > 2) {
      valorNumerico = Number(partes.join('').replace(/(\d+)(\d{2})$/, '$1.$2'));
    } else {
      valorNumerico = Number(numero.replace(',', '.'));
    }
  } else if (temPonto) {
    const partes = numero.split('.');
    if (partes.length > 2) {
      valorNumerico = Number(partes.join(''));
    } else {
      valorNumerico = Number(numero);
    }
  } else {
    valorNumerico = Number(numero);
  }

  if (!Number.isFinite(valorNumerico)) return 0;

  const valorAbsoluto = Math.abs(valorNumerico);
  if (!/[.,]/.test(entrada) && valorAbsoluto >= 100000 && Number.isInteger(valorNumerico) && valorNumerico % 100 === 0) {
    const corrigido = valorNumerico / 100;
    if (corrigido >= 1 && corrigido <= 50000) {
      valorNumerico = corrigido;
    }
  }

  return Number((valorNumerico * sinal).toFixed(2));
}

module.exports = { normalizarPreco };
