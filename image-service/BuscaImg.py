import os
import time
import requests
import cloudinary
import cloudinary.uploader
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
BACK_ENV = PROJECT_ROOT / "Back" / ".env"
load_dotenv(BACK_ENV if BACK_ENV.exists() else PROJECT_ROOT / ".env")

# ====================== CONFIGURAÇÕES ======================
MONGODB_URI = os.getenv("MONGODB_URI")
# Back/server.js conecta ao banco "catalogo" e Mongoose usa a coleção "produtos"
# para o model Produto. Não deixe uma variável local apontar o script para outra base.
MONGODB_DB = "catalogo"
MONGODB_COLLECTION = "produtos"
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

# Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

IMAGENS_POR_PRODUTO = 2
DELAY_ENTRE_PRODUTOS = 1.5
# ===========================================================


def conectar_mongodb():
    client = MongoClient(MONGODB_URI)
    db = client.get_database(MONGODB_DB)
    return db[MONGODB_COLLECTION]


def detectar_site(nome_produto: str) -> str:
    nome = nome_produto.lower()

    if any(x in nome for x in ["iphone", "ipad", "macbook", "airpods", "apple watch", "imac", "mac mini", "mac studio", "apple"]):
        return "site:apple.com"
    elif any(x in nome for x in ["garmin", "fenix", "forerunner", "epix", "instinct", "vivoactive", "venu", "approach", "marq"]):
        return "site:garmin.com"
    elif any(x in nome for x in ["fitbit", "charge", "versa", "sense", "inspire", "luxe", "pixel watch"]):
        return "site:fitbit.com"
    else:
        return ""


def buscar_imagens_serpapi(nome_produto: str, num_imagens: int = 2):
    site = detectar_site(nome_produto)
    query = f"{nome_produto} {site}".strip()
    print(f"  → Buscando: {query}")

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": num_imagens,
        "ijn": "0",
    }

    try:
        response = requests.get("https://serpapi.com/search", params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        return [item["original"] for item in data.get("images_results", [])[:num_imagens] if item.get("original")]
    except Exception as e:
        print(f"  [ERRO] {e}")
        return []


def upload_cloudinary(url_imagem: str, nome_produto: str, indice: int):
    """Faz upload da imagem para o Cloudinary e retorna a URL pública"""
    try:
        resultado = cloudinary.uploader.upload(
            url_imagem,
            folder="catalogo_produtos",          # pasta no Cloudinary
            public_id=f"{nome_produto}_{indice}", # nome do arquivo
            overwrite=True,
            resource_type="image"
        )
        return resultado.get("secure_url")
    except Exception as e:
        print(f"    → Erro no upload Cloudinary: {e}")
        return None


def limpar_nome(nome: str) -> str:
    invalidos = r'<>:"/\|?*'
    for char in invalidos:
        nome = nome.replace(char, "")
    return nome.strip()[:60]


def imagem_cloudinary(url: str) -> bool:
    try:
        return urlparse(url).hostname == "res.cloudinary.com"
    except (TypeError, ValueError):
        return False


def obter_imagens_cloudinary(produto: dict) -> list[str]:
    imagens = [produto.get("imagem"), *(produto.get("galeria") or [])]
    return list(dict.fromkeys(url for url in imagens if isinstance(url, str) and imagem_cloudinary(url)))


def main():
    if not MONGODB_URI:
        raise RuntimeError("Configure MONGODB_URI no Back/.env.")
    if not SERPAPI_KEY:
        raise RuntimeError("Configure SERPAPI_KEY no Back/.env ou no .env da raiz.")
    if not all(os.getenv(chave) for chave in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")):
        raise RuntimeError("Configure as credenciais do Cloudinary no Back/.env.")

    print("Conectando ao MongoDB...")
    collection = conectar_mongodb()
    print(f"Base/coleção usadas pelo site: {MONGODB_DB}.{MONGODB_COLLECTION}")

    produtos = list(collection.find(
        {},
        {"_id": 1, "nome": 1, "imagem": 1, "galeria": 1,
         "variants._id": 1, "variants.cor": 1, "variants.capacidade": 1,
         "variants.nomeLegado": 1, "variants.imagens": 1}
    ))

    total = len(produtos)
    print(f"Encontrados {total} produtos.\n")

    for i, produto in enumerate(produtos, 1):
        nome = produto.get("nome", "Sem nome")
        produto_id = produto["_id"]

        print(f"\n[{i}/{total}] {nome}")

        nome_limpo = limpar_nome(nome)
        imagens_modelo = obter_imagens_cloudinary(produto)
        variantes = produto.get("variants") or []

        if variantes:
            for indice_variante, variante in enumerate(variantes, 1):
                variante_id = variante.get("_id")
                if not variante_id:
                    print(f"  → Variante {indice_variante} sem _id; não foi possível associar imagens.")
                    continue

                imagens_existentes = [
                    url for url in (variante.get("imagens") or [])
                    if isinstance(url, str) and imagem_cloudinary(url)
                ]
                if imagens_existentes:
                    print(f"  → {variante.get('cor', '')} {variante.get('capacidade', '')}: já possui imagem Cloudinary.")
                    continue

                # Imagens já cadastradas no documento do modelo também servem
                # como fallback, mas precisam ser copiadas para a variante:
                # ProdutoDetalhe consome variants[].imagens.
                urls_cloudinary = imagens_modelo[:IMAGENS_POR_PRODUTO]
                if not urls_cloudinary:
                    nome_variante = variante.get("nomeLegado") or (
                        f"{nome} {variante.get('cor', '')} {variante.get('capacidade', '')}"
                    ).strip()
                    urls = buscar_imagens_serpapi(nome_variante, IMAGENS_POR_PRODUTO)
                    for idx, url in enumerate(urls, 1):
                        print(f"  → Enviando imagem {idx} de {variante.get('cor', '')} {variante.get('capacidade', '')}...")
                        url_final = upload_cloudinary(
                            url,
                            f"{produto_id}_{variante_id}_{limpar_nome(nome_variante)}",
                            idx
                        )
                        if url_final:
                            urls_cloudinary.append(url_final)

                if urls_cloudinary:
                    resultado = collection.update_one(
                        {"_id": produto_id, "variants._id": variante_id},
                        {"$set": {"variants.$.imagens": urls_cloudinary}}
                    )
                    if (
                        resultado.matched_count
                        and resultado.modified_count
                    ):
                        print(f"  → Imagens associadas à variante {variante.get('sku', variante_id)}.")
                    elif resultado.matched_count:
                        print(
                            "  → Imagens da variante "
                            f"{variante.get('sku', variante_id)} "
                            "já estavam atualizadas."
                        )
                    else:
                        print(
                            f"  → Variante {variante.get('sku', variante_id)} "
                            f"não encontrada em {MONGODB_DB}."
                            f"{MONGODB_COLLECTION}."
                        )
                else:
                    print(f"  → Nenhuma imagem encontrada para {variante.get('cor', '')} {variante.get('capacidade', '')}.")
        else:
            if imagens_modelo:
                print("  → Produto já tem imagem Cloudinary, pulando.")
                continue

            urls = buscar_imagens_serpapi(nome, IMAGENS_POR_PRODUTO)
            if not urls:
                print("  → Nenhuma imagem encontrada")
                continue

            urls_cloudinary = []
            for idx, url in enumerate(urls, 1):
                print(f"  → Enviando imagem {idx} para Cloudinary...")
                url_final = upload_cloudinary(url, nome_limpo, idx)
                if url_final:
                    urls_cloudinary.append(url_final)

            if urls_cloudinary:
                resultado = collection.update_one(
                    {"_id": produto_id},
                    {"$set": {"imagem": urls_cloudinary[0], "galeria": urls_cloudinary}}
                )
                if (
                    resultado.matched_count
                    and resultado.modified_count
                ):
                    print("  → Imagens Cloudinary associadas ao produto no MongoDB.")
                elif resultado.matched_count:
                    print("  → Imagens do produto já estavam atualizadas.")
                else:
                    print(
                        f"  → Produto não encontrado em {MONGODB_DB}."
                        f"{MONGODB_COLLECTION}."
                    )

        time.sleep(DELAY_ENTRE_PRODUTOS)

    print("\n✅ Processo finalizado!")


if __name__ == "__main__":
    main()