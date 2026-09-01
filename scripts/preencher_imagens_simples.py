#!/usr/bin/env python3
"""
Script para preencher imagens de produtos no MongoDB
Versão síncrona com pymongo
"""

import os
import sys
import logging
from typing import Optional
import requests
from urllib.parse import quote

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
except ImportError as e:
    logger.error(f"❌ Dependência faltando: {e}")
    sys.exit(1)

load_dotenv()

MONGO_URI = os.getenv('MONGODB_URI')
UNSPLASH_KEY = os.getenv('UNSPLASH_ACCESS_KEY', '')
PIXABAY_KEY = os.getenv('PIXABAY_API_KEY', '')


def buscar_imagem_unsplash(nome: str) -> Optional[str]:
    """Busca no Unsplash"""
    if not UNSPLASH_KEY:
        return None
    try:
        url = f"https://api.unsplash.com/search/photos?query={quote(nome)}&per_page=1"
        resp = requests.get(url, headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("results"):
                return data["results"][0]["urls"]["regular"]
    except Exception as e:
        logger.debug(f"Unsplash erro: {e}")
    return None


def buscar_imagem_pixabay(nome: str) -> Optional[str]:
    """Busca no Pixabay"""
    if not PIXABAY_KEY:
        return None
    try:
        url = f"https://pixabay.com/api/?key={PIXABAY_KEY}&q={quote(nome)}&image_type=photo&order=popular&per_page=1"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("hits"):
                return data["hits"][0]["webformatURL"]
    except Exception as e:
        logger.debug(f"Pixabay erro: {e}")
    return None


def validar_url(url: str) -> bool:
    """Valida se URL é uma imagem real"""
    if not url or not url.startswith('http'):
        return False
    try:
        resp = requests.head(url, timeout=8, allow_redirects=True)
        return 200 <= resp.status_code < 400 and 'image' in resp.headers.get('content-type', '')
    except:
        return False


def buscar_imagem_produto(nome: str) -> Optional[str]:
    """Busca imagem de um produto"""
    nome_limpo = str(nome or '').strip()
    if not nome_limpo:
        return None
    
    fontes = [
        ("Unsplash", buscar_imagem_unsplash),
        ("Pixabay", buscar_imagem_pixabay)
    ]
    
    for tentativa in range(1, 3):
        for fonte_nome, fonte_func in fontes:
            try:
                url = fonte_func(nome_limpo)
                if url and validar_url(url):
                    return url
            except:
                pass
    
    return None


def main():
    """Função principal"""
    if not MONGO_URI:
        logger.error("❌ MONGODB_URI não configurada")
        return
    
    logger.info("🚀 Iniciando preenchimento de imagens...")
    
    try:
        # Conectar ao MongoDB com banco especificado
        uri_com_banco = MONGO_URI.rstrip('/') + '/catalogo'
        client = MongoClient(uri_com_banco)
        db = client['catalogo']
        col = db["produtos"]
        
        # Buscar produtos sem imagem
        produtos = list(col.find({
            "$or": [
                {"imagem": {"$exists": False}},
                {"imagem": ""},
                {"imagem": None}
            ]
        }).limit(1000))  # Limita para não sobrecarregar
        
        logger.info(f"📦 Produtos para atualizar: {len(produtos)}")
        
        encontrados = 0
        sem_resultado = 0
        
        for i, prod in enumerate(produtos, 1):
            nome = prod.get('nome', 'produto')
            produto_id = prod.get('_id')
            
            imagem = buscar_imagem_produto(nome)
            
            if imagem:
                col.update_one({"_id": produto_id}, {"$set": {"imagem": imagem}})
                encontrados += 1
                logger.info(f"✅ [{i}/{len(produtos)}] {nome[:50]}")
            else:
                sem_resultado += 1
                logger.info(f"❌ [{i}/{len(produtos)}] {nome[:50]}")
            
            # Pequena pausa para não sobrecarregar
            if i % 10 == 0:
                logger.info(f"   Progresso: {i}/{len(produtos)}")
        
        logger.info(f"\n📊 Resumo Final:")
        logger.info(f"✅ Imagens preenchidas: {encontrados}")
        logger.info(f"❌ Sem resultado: {sem_resultado}")
        logger.info(f"📈 Total: {encontrados + sem_resultado}/{len(produtos)}")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
