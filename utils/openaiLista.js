const axios = require('axios');

function validarOpenAI(apiKey, modelo) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey.trim())) {
    throw new Error('Informe uma API key válida da OpenAI.');
  }
  if (typeof modelo !== 'string' || !/^[a-zA-Z0-9._:-]{1,150}$/.test(modelo)) {
    throw new Error('Informe um modelo válido da OpenAI.');
  }
}

async function completarOpenAI(payload, apiKey) {
  try {
    const { data } = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      timeout: 60000
    });
    if (data.choices?.[0]?.finish_reason !== 'stop' || !data.choices[0]?.message?.content) {
      throw new Error('Resposta incompleta da OpenAI. Tente novamente com uma lista menor.');
    }
    return data;
  } catch (error) {
    // Nunca propagar o erro Axios: ele contém o header com a chave.
    const status = error.response?.status;
    if (status === 401) throw new Error('API key da OpenAI inválida ou revogada.');
    if (status === 429) throw new Error('Limite da OpenAI atingido. Verifique os créditos e tente novamente.');
    if (status === 400 || status === 403 || status === 404) throw new Error('Verifique o modelo e as permissões da sua chave OpenAI.');
    throw new Error('Não foi possível concluir a resposta da OpenAI. Tente novamente.');
  }
}

module.exports = { validarOpenAI, completarOpenAI };
