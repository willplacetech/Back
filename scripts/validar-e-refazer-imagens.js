/**
 * Script para validar imagens salvas no banco
 * Se estiverem quebradas, tenta buscar novas
 */

const mongoose = require('mongoose');
const Produto = require('../models/Produto');
const { buscarImagemProduto, validarImagemUrl } = require('../utils/imagemSearch');
require('dotenv').config();

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

async function processarProdutos() {
  try {
    // Conectar ao banco
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar todos os produtos
    const produtos = await Produto.find({});
    console.log(`📦 Total de produtos encontrados: ${produtos.length}\n`);

    let imagensValidas = 0;
    let imagensBuscadas = 0;
    let imagensInvalidas = 0;

    // Processar em lotes de 5
    for (let i = 0; i < produtos.length; i += 5) {
      const lote = produtos.slice(i, i + 5);
      
      await Promise.all(
        lote.map(async (produto) => {
          const numProduto = i + lote.indexOf(produto) + 1;
          const percentual = ((numProduto / produtos.length) * 100).toFixed(1);
          
          try {
            // Validar imagem atual
            if (produto.imagem) {
              const valida = await validarImagemUrl(produto.imagem);
              
              if (valida) {
                console.log(`✅ [${numProduto}/${produtos.length}] ${percentual}% - ${produto.nome} (imagem OK)`);
                imagensValidas++;
                return;
              } else {
                console.log(`⚠️  [${numProduto}/${produtos.length}] ${percentual}% - ${produto.nome} (imagem quebrada)`);
              }
            } else {
              console.log(`⚠️  [${numProduto}/${produtos.length}] ${percentual}% - ${produto.nome} (sem imagem)`);
            }

            // Tentar buscar nova imagem
            console.log(`   🔄 Buscando nova imagem para: ${produto.nome}`);
            const novaImagem = await buscarImagemProduto(produto.nome, {
              unsplashKey: UNSPLASH_KEY,
              pixabayKey: PIXABAY_KEY,
              tentarBing: true
            });

            if (novaImagem) {
              await Produto.updateOne(
                { _id: produto._id },
                { $set: { imagem: novaImagem } }
              );
              console.log(`   ✅ Nova imagem encontrada e salva!`);
              imagensBuscadas++;
            } else {
              console.log(`   ❌ Nenhuma imagem encontrada`);
              imagensInvalidas++;
            }
          } catch (erro) {
            console.error(`   ❌ Erro ao processar: ${erro.message}`);
            imagensInvalidas++;
          }
        })
      );

      // Pausa entre lotes
      if (i + 5 < produtos.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n📊 Resumo Final:');
    console.log(`✅ Imagens válidas: ${imagensValidas}`);
    console.log(`🔄 Imagens refazidas: ${imagensBuscadas}`);
    console.log(`❌ Imagens inválidas: ${imagensInvalidas}`);
    console.log(`📈 Total validado: ${imagensValidas + imagensBuscadas + imagensInvalidas}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (erro) {
    console.error('❌ Erro fatal:', erro.message);
    process.exit(1);
  }
}

// Executar
processarProdutos();
