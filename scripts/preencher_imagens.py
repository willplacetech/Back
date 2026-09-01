#!/usr/bin/env python3
"""
Script para preencher imagens de produtos no MongoDB
Busca imagens por nome do produto usando múltiplas fontes
"""

import os
import asyncio
import aiohttp
from typing import Optional
from datetime import datetime
from urllib.parse import urljoin
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from motor.motor_asyncio import AsyncClient as MongoAsyncClient
    from pymongo import ASCENDING
except ImportError:
    logger.error("❌ Motor não instalado. Execute: pip install motor pymongo")
    exit(1)

from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGODB_URI')
UNSPLASH_KEY = os.getenv('UNSPLASH_ACCESS_KEY', '')
PIXABAY_KEY = os.getenv('PIXABAY_API_KEY', '')


async def buscar_imagem_unsplash(session: aiohttp.ClientSession, nome: str) -> Optional[str]:
    """Busca imagem no Unsplash"""
    if not UNSPLASH_KEY:
        return None
    
    try:
        url = f"https://api.unsplash.com/search/photos?query={nome}&per_page=1&order_by=relevant"
        async with session.get(url, headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"}, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get("results") and len(data["results"]) > 0:
                    return data["results"][0]["urls"]["regular"]
    except Exception as e:
        logger.debug(f"Erro Unsplash: {e}")
    
    return None


async def buscar_imagem_pixabay(session: aiohttp.ClientSession, nome: str) -> Optional[str]:
    """Busca imagem no Pixabay"""
    if not PIXABAY_KEY:
        return None
    
    try:
        url = f"https://pixabay.com/api/?key={PIXABAY_KEY}&q={nome}&image_type=photo&order=popular&per_page=1"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get("hits") and len(data["hits"]) > 0:
                    return data["hits"][0]["webformatURL"]
    except Exception as e:
        logger.debug(f"Erro Pixabay: {e}")
    
    return None


async def buscar_imagem_bing(session: aiohttp.ClientSession, nome: str) -> Optional[str]:
    """Busca imagem via Bing (sem API key)"""
    try:
        url = f"https://www.bing.com/images/search?q={nome}&FORM=IQFRBA"
        async with session.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=aiohttp.ClientTimeout(total=15)
        ) as resp:
            if resp.status == 200:
                html = await resp.text()
                # Busca por padrão de imagem no HTML
                import re
                matches = re.findall(r'"(?:murl|thumburl)":"([^"]+)"', html)
                if matches:
                    return matches[0].replace('\\u002f', '/').replace('\\u0026', '&')
    except Exception as e:
        logger.debug(f"Erro Bing: {e}")
    
    return None


async def validar_url_imagem(session: aiohttp.ClientSession, url: str) -> bool:
    """Valida se a URL é uma imagem real"""
    if not url or not url.startswith('http'):
        return False
    
    try:
        async with session.head(url, timeout=aiohttp.ClientTimeout(total=8), allow_redirects=True) as resp:
            if 200 <= resp.status < 400:
                content_type = resp.headers.get('content-type', '').lower()
                return 'image' in content_type or any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif'])
    except Exception:
        pass
    
    return False


async def buscar_imagem_produto(session: aiohttp.ClientSession, nome: str) -> Optional[str]:
    """Busca imagem de um produto tentando múltiplas fontes"""
    nome_limpo = str(nome or '').strip()
    if not nome_limpo:
        return None
    
    # Tenta 3 vezes com diferentes combinações
    for tentativa in range(1, 4):
        fontes = [
            ("Unsplash", buscar_imagem_unsplash),
            ("Pixabay", buscar_imagem_pixabay),
            ("Bing", buscar_imagem_bing)
        ]
        
        for fonte_nome, fonte_func in fontes:
            try:
                url = await fonte_func(session, nome_limpo)
                if url and await validar_url_imagem(session, url):
                    logger.info(f"✅ {nome_limpo} (fonte: {fonte_nome})")
                    return url
            except Exception as e:
                logger.debug(f"Erro na tentativa {tentativa} em {fonte_nome}: {e}")
    
    logger.info(f"❌ {nome_limpo}")
    return None


async def main():
    """Função principal"""
    if not MONGO_URI:
        logger.error("❌ MONGODB_URI não configurada")
        return
    
    # Conectar ao MongoDB
    client = MongoAsyncClient(MONGO_URI)
    db = client.get_default_database()
    produtos_col = db["produtos"]
    
    try:
        # Buscar produtos sem imagem ou com imagem inválida
        produtos = await produtos_col.find({
            "$or": [
                {"imagem": {"$exists": False}},
                {"imagem": ""},
                {"imagem": {"$regex": "^(?!https?://)"}}
            ]
        }).to_list(None)
        
        logger.info(f"📦 Produtos com imagem vazia ou inválida: {len(produtos)}")
        
        if not produtos:
            logger.info("✨ Nenhum produto para atualizar")
            return
        
        encontrados = 0
        sem_resultado = 0
        
        async with aiohttp.ClientSession() as session:
            # Processar em lotes de 5
            for i in range(0, len(produtos), 5):
                lote = produtos[i:i+5]
                
                tarefas = [
                    processar_produto(session, produtos_col, prod)
                    for prod in lote
                ]
                
                resultados = await asyncio.gather(*tarefas, return_exceptions=True)
                
                for resultado in resultados:
                    if isinstance(resultado, bool):
                        if resultado:
                            encontrados += 1
                        else:
                            sem_resultado += 1
        
        logger.info(f"\n📊 Resumo Final:")
        logger.info(f"✅ Imagens preenchidas: {encontrados}")
        logger.info(f"❌ Sem resultado: {sem_resultado}")
        logger.info(f"📈 Total processado: {encontrados + sem_resultado}/{len(produtos)}")
        
    finally:
        client.close()


async def processar_produto(session: aiohttp.ClientSession, col, produto: dict) -> bool:
    """Processa um único produto"""
    nome = produto.get('nome', 'produto')
    produto_id = produto.get('_id')
    
    imagem = await buscar_imagem_produto(session, nome)
    
    if imagem:
        await col.update_one(
            {"_id": produto_id},
            {"$set": {"imagem": imagem}}
        )
        return True
    
    return False


if __name__ == "__main__":
    logger.info("🚀 Iniciando preenchimento de imagens em Python...\n")
    asyncio.run(main())
    logger.info("\n✨ Processo concluído!")
