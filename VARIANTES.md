# Catálogo por modelo e variantes

O repositório usa `Back/models/Produto.js` e `Front/src/components`, em vez de `server/models` e `src/components` na raiz. O modelo Mongoose e a coleção continuam sendo `Produto`/`produtos`, para preservar referências dos pedidos existentes.

Cada modelo tem `nome`, `marca`, `categoria` (`Lacrado`, `CPO` ou `Watch`), `specs` (`tela`, `chip`, `camera`, `bateria`) e `variants`. `ProductVariant.js` define os subdocumentos com `cor`, `capacidade`, `preco` de venda, `estoque`, `sku` e `imagens`. `precoCusto`, `nomeLegado` e `produtoLegadoId` preservam o custo e a identidade anterior. SKU é único no catálogo e cor/capacidade são únicos dentro de um modelo.

## Venda sob encomenda

`estoque: null` significa sob encomenda, sem quantidade fictícia ou limite de unidades no carrinho. `disponivel: false` suspende uma oferta. Um inteiro positivo permite informar estoque físico; zero torna a variante indisponível. O checkout confere essa quantidade no servidor. A criação de pedidos continua sendo uma solicitação pendente encaminhada ao WhatsApp; não reserva nem baixa estoque físico automaticamente.

## Migração

Execute dentro de `Back`, com `MONGODB_URI` configurada no `.env`:

```powershell
npm.cmd run migrate:variants -- --dry-run
```

O modo padrão também é simulação: não cria documentos, coleções ou índices. Mostra os agrupamentos e valida os documentos projetados. A migração identifica nomes do catálogo atual, incluindo cores compostas e tamanhos de Apple Watch. Mantém RAM, conectividade e qualificadores técnicos como parte do modelo. Produtos sem cor/capacidade identificável ficam com a opção `Padrão`; revise esses grupos na simulação. As especificações técnicas existentes são preservadas; campos ausentes ficam vazios, sem inventar características.

Depois de revisar a simulação, para persistir:

```powershell
npm.cmd run migrate:variants -- --apply
```

Antes das escritas, cria um backup completo em `Back/backups/produtos-antes-variantes-*.json`, em MongoDB Extended JSON para preservar ObjectIds e datas. Aplica os agrupamentos em uma transação: requer MongoDB replica set, como Atlas. Erros abortam a transação. Confere alterações concorrentes antes de escrever; prefira aplicar em uma janela sem cadastros/edições.

Cada grupo mantém um ID de produto existente. Os outros documentos do grupo são removidos somente dentro da transação, e seus IDs ficam preservados nas variantes. Pedidos históricos mantêm os snapshots dos itens; carrinhos antigos que enviarem um ID removido são resolvidos pela variante correspondente. Executar novamente não duplica modelos já migrados. Duplicidade de cor/capacidade ou SKU interrompe a migração para revisão, sem escolher preços ou somar estoques arbitrariamente. Os índices declarados no schema são criados pelo backend ao conectar normalmente após a migração.

Os preços personalizados existentes são preservados. Sem preço personalizado, mantém a fórmula anterior do catálogo: custo × 1,07 + R$ 500. As variantes indisponíveis continuam indisponíveis; as demais ficam sob encomenda. A opção `--estoque-padrao=N` existe para uma eventual migração com estoque físico.

## API e interface

- `GET /api/produtos`: público, agrupado, com `precoAPartir` calculado das variantes disponíveis.
- `GET /api/produtos/:id`: público, modelo completo com variantes, imagens e especificações. IDs legados também são reconhecidos.
- `GET /api/filtros`: marcas, categorias, modelos, cores e capacidades. Aceita `marca`, `categoria`, `modelo`, `cor`, `capacidade`; cada nível respeita os anteriores.
- `GET /api/produtos/disponiveis`: mantém a URL anterior e retorna o catálogo agrupado.
- `GET /api/produtos/administracao`: exige autenticação e inclui indisponíveis, usado pelo painel e pelos relatórios.
- `POST /api/produtos`, `PUT /api/produtos/:id`: exigem autenticação; aceitam modelos com `variants` e calculam campos antigos de preço para compatibilidade. Cadastros individuais e importação em lote acrescentam/atualizam variantes no modelo correspondente.
- `PUT /api/produtos/:id/variants/:variantId`: exige autenticação; edita uma variante.
- `POST /api/pedidos`: recebe `produtoId`, `variantId`, `sku` e `quantidade`. Confere a variante, disponibilidade e SKU; calcula preços e total a partir do servidor. Cores/capacidades diferentes ficam em itens separados.

No painel, editar um modelo agrupado abre a edição das variantes, com preço, custo, SKU, imagens, disponibilidade e estoque opcional. Importação de preços continua encontrando o nome completo anterior em `variants.nomeLegado` e atualiza somente a oferta correspondente.

Exemplo de modelo novo:

```json
{
  "nome": "iPhone 17 Pro Max",
  "marca": "Apple",
  "categoria": "Lacrado",
  "specs": { "tela": "", "chip": "", "camera": "", "bateria": "" },
  "variants": [
    { "cor": "Prata", "capacidade": "256GB", "preco": 7500, "estoque": null, "sku": "IP17PM-PRATA-256", "imagens": [] }
  ]
}
```

O frontend usa `/produto/:id`. Os filtros ficam na URL e são preservados ao voltar ao catálogo. A tela de detalhe mostra todas as combinações cadastradas, desabilita as indisponíveis e envia a opção selecionada ao carrinho.

## Verificação sem banco

```powershell
# Dentro de Back
npm.cmd test
# Dentro de Front
npm.cmd test
npm.cmd run build
```

Os testes cobrem 3 cores × 3 capacidades em um documento, migração repetida, nomes reais, filtros, preço mínimo, estoque opcional, carrinhos legados, SKUs e validação dos pedidos via HTTP. Nenhum deles conecta ao MongoDB.

`node scripts/verificar-variantes-browser.js`, dentro de `Back`, verifica o fluxo no Chrome local usando CDP nativo do Node 24, API em memória e Vite na porta 5180. Pode configurar `CHROME_PATH`. Gera capturas desktop/mobile na pasta `.verification` da raiz; não instala ferramentas nem acessa o banco.
