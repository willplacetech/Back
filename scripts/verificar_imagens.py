#!/usr/bin/env python3
"""Verifica quantas imagens foram preenchidas no banco"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv('MONGODB_URI')

try:
    uri_com_banco = MONGO_URI.rstrip('/') + '/catalogo'
    client = MongoClient(uri_com_banco)
    db = client['catalogo']
    col = db['produtos']
    
    total = col.count_documents({})
    com_imagem = col.count_documents({"imagem": {"$exists": True, "$ne": "", "$ne": None}})
    sem_imagem = col.count_documents({
        "$or": [
            {"imagem": {"$exists": False}},
            {"imagem": ""},
            {"imagem": None}
        ]
    })
    
    print(f"📊 Resumo de Imagens no Banco:")
    print(f"📦 Total de produtos: {total}")
    print(f"✅ Com imagem: {com_imagem}")
    print(f"❌ Sem imagem: {sem_imagem}")
    if total > 0:
        percentual = (com_imagem/total*100)
        print(f"📈 Percentual preenchido: {percentual:.1f}%")
    
    client.close()
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
