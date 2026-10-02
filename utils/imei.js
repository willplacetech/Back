function imeiValido(imei) {
  if (typeof imei !== 'string' || !/^[0-9]{15}$/.test(imei)) return false;
  let soma = 0;
  for (let indice = 0; indice < imei.length; indice++) {
    let digito = Number(imei[indice]);
    // Nos 15 dígitos, dobra as posições pares contando a partir da esquerda.
    if (indice % 2 === 1) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    soma += digito;
  }
  return soma % 10 === 0;
}

module.exports = { imeiValido };
