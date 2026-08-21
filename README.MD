# Placetech Backend

API da Placetech Lindoia — Sistema de Catálogo e Pedidos

## Tecnologias
- Node.js + Express
- MongoDB
- Mercado Livre / Extração de links

## Variáveis de Ambiente
Crie um arquivo `.env`:

```env
MONGODB_URI=mongodb+srv://...
PORT=5000
ADMIN_USER=admin
ADMIN_PASSWORD=uma-senha-forte
JWT_SECRET=uma-chave-longa-e-aleatoria
```

`ADMIN_PASSWORD` e `JWT_SECRET` não devem ser commitados nem compartilhados. O frontend pode apontar para outra API usando `VITE_API_URL` no ambiente de build.