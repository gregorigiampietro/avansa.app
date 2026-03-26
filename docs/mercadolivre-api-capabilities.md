# API do Mercado Livre — Todas as Possibilidades

> Referência completa de recursos disponíveis na API do Mercado Livre para integração com o Avansa.
> Base URL: `https://api.mercadolibre.com` | Site ID Brasil: `MLB`

---

## 1. Autenticação e OAuth

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Autorização (PKCE) | GET | `https://auth.mercadolibre.com/authorization` | Redireciona o usuário para login e autorização |
| Obter token | POST | `/oauth/token` | Troca authorization code por access_token + refresh_token |
| Renovar token | POST | `/oauth/token` | Renova token usando refresh_token (grant_type=refresh_token) |

**Detalhes:**
- Token expira em 6h (21.600s)
- Suporta PKCE (code_verifier + code_challenge SHA-256)
- Refresh token não expira, mas é invalidado ao gerar novo

---

## 2. Usuários

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Dados do usuário autenticado | GET | `/users/me` | Retorna dados completos do vendedor logado |
| Dados de um usuário | GET | `/users/{user_id}` | Dados públicos de qualquer usuário |
| Endereços do usuário | GET | `/users/{user_id}/addresses` | Lista endereços cadastrados |
| Aceite de termos | GET | `/users/{user_id}/acceptance/{acceptance_id}` | Verifica aceite de termos |

---

## 3. Itens / Anúncios

### 3.1 CRUD de Itens

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Criar item | POST | `/items` | Cria um novo anúncio |
| Detalhe do item | GET | `/items/{item_id}` | Retorna todos os dados de um anúncio |
| Multi-get itens | GET | `/items?ids=MLB1,MLB2,...` | Busca até 20 itens de uma vez |
| Atualizar item | PUT | `/items/{item_id}` | Atualiza preço, estoque, status, título, etc. |
| Buscar itens do vendedor | GET | `/users/{user_id}/items/search` | Lista itens com filtros (status, SKU, etc.) |

### 3.2 Ações em Itens

| Ação | Método | Body | Descrição |
|------|--------|------|-----------|
| Atualizar preço | PUT `/items/{id}` | `{ "price": 299.90 }` | Altera preço do anúncio |
| Atualizar estoque | PUT `/items/{id}` | `{ "available_quantity": 50 }` | Altera quantidade disponível |
| Pausar anúncio | PUT `/items/{id}` | `{ "status": "paused" }` | Pausa o anúncio |
| Reativar anúncio | PUT `/items/{id}` | `{ "status": "active" }` | Reativa anúncio pausado |
| Finalizar anúncio | PUT `/items/{id}` | `{ "status": "closed" }` | Encerra o anúncio |
| Alterar título | PUT `/items/{id}` | `{ "title": "Novo título" }` | Atualiza o título |
| Alterar condição de venda | PUT `/items/{id}` | `{ "sale_terms": [...] }` | Altera garantia, faturação, etc. |
| Alterar tipo de listagem | POST `/items/{id}/listing_type` | `{ "id": "gold_special" }` | Muda tipo (clássico, premium) |

### 3.3 Descrição do Item

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Obter descrição | GET | `/items/{item_id}/description` | Retorna descrição em texto/HTML |
| Atualizar descrição | PUT | `/items/{item_id}/description` | Atualiza descrição do item |

### 3.4 Imagens do Item

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Upload de imagem | POST | `/pictures/items/upload` | Envia imagem e retorna picture_id |
| Associar imagens | PUT | `/items/{item_id}` | Body: `{ "pictures": [{ "id": "..." }] }` |
| Remover imagem | PUT | `/items/{item_id}` | Enviar array de pictures sem a imagem a remover |

### 3.5 Variações

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar variações | GET | `/items/{item_id}/variations` | Retorna todas as variações do item |
| Detalhe da variação | GET | `/items/{item_id}/variations/{variation_id}` | Dados de uma variação específica |
| Criar variação | POST | `/items/{item_id}/variations` | Adiciona nova variação (cor, tamanho, etc.) |
| Atualizar variação | PUT | `/items/{item_id}/variations/{variation_id}` | Atualiza preço/estoque da variação |
| Remover variação | DELETE | `/items/{item_id}/variations/{variation_id}` | Remove uma variação |

### 3.6 Preços e Comissões

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Preço do item | GET | `/items/{item_id}/prices` | Retorna preço atual e descontos |
| Calcular comissão | GET | `/sites/MLB/listing_prices?price={price}&listing_type_id={type}&category_id={cat}` | Simula comissão + frete grátis |

### 3.7 Filtros de Busca de Itens

```
GET /users/{user_id}/items/search?status=active          # Por status (active, paused, closed)
GET /users/{user_id}/items/search?seller_sku={SKU}        # Por SKU
GET /users/{user_id}/items/search?q={texto}               # Por texto
GET /users/{user_id}/items/search?offset=0&limit=50       # Paginação (max 50)
GET /users/{user_id}/items/search?reputation_health_gauge=unhealthy  # Saúde do anúncio
```

---

## 4. Catálogo

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Buscar produto no catálogo | GET | `/products/search?q={query}&site_id=MLB` | Busca produtos no catálogo oficial |
| Detalhe do produto catálogo | GET | `/products/{product_id}` | Dados completos do produto catálogo |
| Concorrência no catálogo | GET | `/products/{product_id}/items` | Lista todos os vendedores competindo no mesmo produto |
| Sugestão de catálogo | GET | `/items/{item_id}/catalog_product_id/suggestions` | Sugestão de vinculação ao catálogo |
| Vincular ao catálogo | POST | `/items/{item_id}/catalog_product_id` | Vincula item a um produto do catálogo |
| Desvincular do catálogo | DELETE | `/items/{item_id}/catalog_product_id` | Remove vínculo com catálogo |

---

## 5. Categorias e Atributos

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Árvore de categorias | GET | `/sites/MLB/categories` | Lista todas as categorias raiz |
| Subcategorias | GET | `/categories/{category_id}` | Retorna filhos e detalhes da categoria |
| Atributos da categoria | GET | `/categories/{category_id}/attributes` | Lista atributos obrigatórios/opcionais |
| Predizer categoria | GET | `/sites/MLB/domain_discovery/search?q={title}` | Sugere categoria com base no título |
| Tipos de listagem | GET | `/sites/MLB/listing_types` | Lista tipos: gold_special, gold_pro, etc. |

---

## 6. Pedidos / Vendas (Orders)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Buscar pedidos | GET | `/orders/search?seller={user_id}` | Lista pedidos do vendedor com filtros |
| Detalhe do pedido | GET | `/orders/{order_id}` | Dados completos de um pedido |
| Notas do pedido | GET | `/orders/{order_id}/notes` | Notas internas do pedido |
| Criar nota no pedido | POST | `/orders/{order_id}/notes` | Adiciona nota interna |
| Feedback do pedido | GET | `/orders/{order_id}/feedback` | Avaliação do comprador/vendedor |
| Responder feedback | POST | `/orders/{order_id}/feedback` | Publica avaliação |

### Filtros de Pedidos

```
GET /orders/search?seller={user_id}&order.status=paid
GET /orders/search?seller={user_id}&order.date_created.from=2024-01-01T00:00:00.000-03:00
GET /orders/search?seller={user_id}&order.date_created.to=2024-12-31T23:59:59.000-03:00
GET /orders/search?seller={user_id}&sort=date_desc
GET /orders/search?seller={user_id}&offset=0&limit=50
```

### Packs (Carrinho)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Detalhe do pack | GET | `/packs/{pack_id}` | Dados do carrinho (múltiplos itens) |
| Pedidos do pack | GET | `/packs/{pack_id}/orders` | Lista pedidos dentro do pack |

---

## 7. Envios (Shipments / Mercado Envios)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Detalhe do envio | GET | `/shipments/{shipment_id}` | Status, rastreio, dados do envio |
| Histórico de status | GET | `/shipments/{shipment_id}/history` | Timeline de movimentações |
| Label de envio (etiqueta) | GET | `/shipments/{shipment_id}/labels` | Gera PDF da etiqueta para impressão |
| Itens do envio | GET | `/shipments/{shipment_id}/items` | Lista itens dentro do envio |
| Custos do envio | GET | `/shipments/{shipment_id}/costs` | Detalhamento de custos de frete |
| Estimativa de envio | GET | `/items/{item_id}/shipping_options?zip_code={cep}` | Estima prazo e custo por CEP |
| Lead time | GET | `/shipments/lead_time/{shipment_id}` | Prazo estimado de entrega |

### Mercado Envios Flex

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Configurar Flex | PUT | `/users/{user_id}/shipping_preferences` | Ativa/configura Mercado Envios Flex |
| Disponibilidade Flex | GET | `/users/{user_id}/shipping_preferences` | Verifica se Flex está habilitado |

### Fulfillment (Full)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Estoque por localização | GET | `/user-products/{user_product_id}/stock` | Retorna estoque separado: seller vs fulfillment |
| Detalhes fulfillment | GET | `/items/{item_id}/fulfillment` | Dados de fulfillment do item |
| Enviar para Full | POST | `/items/{item_id}/fulfillment` | Solicita envio de produtos ao centro Full |

---

## 8. Perguntas e Respostas

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Perguntas recebidas | GET | `/my/received_questions/search` | Lista perguntas com filtros (status, item) |
| Detalhe da pergunta | GET | `/questions/{question_id}` | Dados de uma pergunta específica |
| Responder pergunta | POST | `/answers` | Responde uma pergunta (`{ "question_id": ..., "text": "..." }`) |
| Deletar pergunta | DELETE | `/questions/{question_id}` | Remove uma pergunta |
| Bloquear usuário | POST | `/users/{user_id}/questions_blacklist` | Bloqueia comprador de perguntar |
| Desbloquear usuário | DELETE | `/users/{user_id}/questions_blacklist/{blocked_id}` | Desbloqueia comprador |

### Filtros de Perguntas

```
GET /my/received_questions/search?status=UNANSWERED    # Não respondidas
GET /my/received_questions/search?status=ANSWERED       # Respondidas
GET /my/received_questions/search?item={item_id}        # Por item
GET /my/received_questions/search?sort=date_created     # Ordenação
GET /my/received_questions/search?limit=10&offset=0     # Paginação
```

---

## 9. Mensagens Pós-Venda

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Mensagens não lidas | GET | `/messages/unread?role=seller&tag=post_sale` | Lista pedidos com mensagens pendentes |
| Mensagens de um pedido | GET | `/messages/packs/{pack_id}/sellers/{user_id}` | Histórico de mensagens do pedido |
| Enviar mensagem | POST | `/messages/packs/{pack_id}/sellers/{user_id}` | Envia mensagem ao comprador |
| Anexar arquivo | POST | `/messages/attachments` | Upload de anexo para mensagem |

---

## 10. Reclamações e Devoluções

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar reclamações | GET | `/post-purchase/v1/claims/search?user_id={user_id}&role=seller` | Busca reclamações |
| Detalhe da reclamação | GET | `/post-purchase/v1/claims/{claim_id}` | Dados completos da reclamação |
| Ações disponíveis | GET | `/post-purchase/v1/claims/{claim_id}/actions` | Ações que o vendedor pode tomar |
| Enviar evidência | POST | `/post-purchase/v1/claims/{claim_id}/actions/evidences` | Upload de provas de envio |
| Responder reclamação | POST | `/post-purchase/v1/claims/{claim_id}/actions/{action}` | Executa ação na reclamação |
| Devoluções | GET | `/post-purchase/v1/claims/{claim_id}/returns` | Dados de devolução |

---

## 11. Advertising (Product Ads)

### 11.1 Campanhas

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar campanhas | GET | `/advertising/{site_id}/advertisers/{user_id}/product_ads/campaigns` | Lista todas as campanhas |
| Criar campanha | POST | `/advertising/{site_id}/advertisers/{user_id}/product_ads/campaigns` | Cria nova campanha customizada |
| Atualizar campanha | PUT | `/advertising/{site_id}/advertisers/{user_id}/product_ads/campaigns/{id}` | Atualiza orçamento, nome, status |
| Deletar campanha | DELETE | `/advertising/{site_id}/advertisers/{user_id}/product_ads/campaigns/{id}` | Remove campanha |

### 11.2 Anúncios (Ads)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar anúncios | GET | `/advertising/{site_id}/advertisers/{user_id}/product_ads/ads/search` | Lista ads com métricas |
| Ativar/pausar ad | PUT | `/advertising/{site_id}/advertisers/{user_id}/product_ads/ads/{ad_id}` | Controla status do ad |
| Alterar lance (bid) | PUT | `/advertising/{site_id}/advertisers/{user_id}/product_ads/ads/{ad_id}` | Ajusta CPC do anúncio |

### 11.3 Métricas de Ads

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Métricas resumidas | GET | `.../product_ads/ads/search?metrics=clicks,prints,ctr,cost,cpc,acos,roas,...&metrics_summary=true` | Impressões, cliques, CTR, CPC, ACOS, ROAS |
| Bonificações | GET | `/advertising/{site_id}/advertisers/{user_id}/product_ads/bonifications` | Bônus ativos e saldo |

**Métricas disponíveis:** clicks, prints (impressões), ctr, cost, cpc, acos, roas, sov (share of voice), cvr, direct_units_quantity, indirect_units_quantity, organic_units_quantity, direct_amount, indirect_amount, total_amount

---

## 12. Promoções e Deals

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar promoções disponíveis | GET | `/seller-promotions/search?seller_id={user_id}` | Campanhas abertas para participar |
| Participar de promoção (DEAL) | POST | `/seller-promotions/items/{item_id}` | Indica item em promoção com deal_price |
| Participar de promoção (SMART) | POST | `/seller-promotions/items/{item_id}?app_version=v2` | Campanhas Smart/Price Matching |
| Listar itens em promoção | GET | `/seller-promotions/promotions/{promo_id}/items` | Itens indicados na promoção |
| Remover de promoção | DELETE | `/seller-promotions/items/{item_id}/promotions/{promo_id}` | Retira item da promoção |

### Automação de Preços

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar itens automatizados | GET | `/pricing-automation/users/{user_id}/items` | Itens com automação de preço ativa |
| Configurar automação | PUT | `/pricing-automation/items/{item_id}` | Ativa/configura automação de preço |
| Remover automação | DELETE | `/pricing-automation/items/{item_id}` | Desativa automação de preço |

---

## 13. Webhooks / Notificações

### Tópicos Disponíveis

| Tópico | Descrição |
|--------|-----------|
| `items` | Criação, atualização e exclusão de itens |
| `orders_v2` | Criação e mudanças em pedidos confirmados |
| `orders_feedback` | Avaliações de compradores/vendedores |
| `questions` | Novas perguntas recebidas |
| `messages` | Mensagens pós-venda |
| `payments` | Mudanças em pagamentos |
| `shipments` | Atualizações de envio/rastreamento |
| `claims` | Reclamações abertas e atualizações |
| `stock` | Mudanças de estoque (fulfillment) |
| `invoices` | Notas fiscais emitidas |

### Estrutura do Webhook

```json
{
  "resource": "/orders/123456789",
  "user_id": 12345678,
  "topic": "orders_v2",
  "application_id": 99999,
  "attempts": 1,
  "sent": "2024-01-15T10:30:00.000Z",
  "received": "2024-01-15T10:30:00.500Z"
}
```

> **Regra:** Responder 200 imediatamente e processar o conteúdo de forma assíncrona.

---

## 14. Reputação e Métricas do Vendedor

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Reputação do vendedor | GET | `/users/{user_id}/seller_reputation` | Nível (MercadoLíder), métricas, taxa de reclamação |
| Status da conta | GET | `/users/{user_id}/sale_status` | Restrições, limite de vendas |
| Visitas do item | GET | `/items/{item_id}/visits` | Contagem de visitas |
| Visitas por período | GET | `/items/{item_id}/visits/time_window?last=30&unit=day` | Visitas nos últimos N dias |
| Tendências | GET | `/trends/MLB` | Produtos em alta no marketplace |
| Tendências por categoria | GET | `/trends/MLB/{category_id}` | Tendências dentro de uma categoria |

---

## 15. Notas Fiscais (Invoices)

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Listar notas fiscais | GET | `/packs/{pack_id}/fiscal_documents` | NF-e vinculadas ao pedido |
| Upload de NF-e | POST | `/packs/{pack_id}/fiscal_documents` | Envia XML da nota fiscal |
| Detalhe da NF-e | GET | `/fiscal_documents/{document_id}` | Dados da nota fiscal |

---

## 16. Financeiro / Billing

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Extrato da conta | GET | `/mercadopago/account/balance` | Saldo disponível no Mercado Pago |
| Movimentações | GET | `/mercadopago/movements/search` | Histórico de transações |
| Detalhe de cobrança | GET | `/sites/MLB/billing/items/{item_id}` | Cobrança por item (tarifa ML) |

---

## 17. Busca no Marketplace

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Buscar itens | GET | `/sites/MLB/search?q={query}` | Busca pública de itens |
| Buscar por categoria | GET | `/sites/MLB/search?category={cat_id}` | Itens de uma categoria |
| Buscar por vendedor | GET | `/sites/MLB/search?seller_id={user_id}` | Itens de um vendedor |
| Filtros disponíveis | GET | `/sites/MLB/search?q={query}` | Response inclui `available_filters` |

---

## 18. Moedas e Sites

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Informações do site | GET | `/sites/MLB` | Dados do Brasil no ML |
| Moedas | GET | `/currencies/BRL` | Detalhes da moeda BRL |
| Países | GET | `/countries/BR` | Dados do Brasil |
| CEP | GET | `/countries/BR/zip_codes/{cep}` | Validação e dados de CEP |
| Cidades | GET | `/cities/{city_id}` | Dados de cidade |
| Estados | GET | `/states/{state_id}` | Dados de estado |

---

## Resumo: O Que Podemos Construir no Avansa

### Já Implementado (MVP)
- [x] OAuth PKCE (conectar contas)
- [x] Sync de itens/anúncios
- [x] Tabela de produtos (preço, estoque, status)
- [x] Sync de pedidos
- [x] Dashboard com métricas
- [x] Edição individual e em massa (preço, estoque, status)
- [x] Webhooks
- [x] Cron de refresh de tokens

### Oportunidades Futuras
- [ ] **Perguntas e Respostas** — Painel para responder perguntas sem sair do Avansa
- [ ] **Mensagens Pós-Venda** — Chat unificado com compradores
- [ ] **Reclamações e Devoluções** — Gestão de claims com upload de evidências
- [ ] **Product Ads** — Gerenciar campanhas de publicidade com métricas de ROAS/ACOS
- [ ] **Promoções e Deals** — Participar de campanhas do ML automaticamente
- [ ] **Automação de Preços** — Configurar preço competitivo automático
- [ ] **Notas Fiscais** — Upload e gestão de NF-e por pedido
- [ ] **Gestão de Imagens** — Upload e reordenação de fotos dos anúncios
- [ ] **Variações** — Criar e gerenciar variações (cor, tamanho) por produto
- [ ] **Catálogo** — Vincular produtos ao catálogo oficial para ganhar Buy Box
- [ ] **Reputação e Métricas** — Dashboard de saúde da conta e visitas
- [ ] **Etiquetas de Envio** — Gerar e imprimir etiquetas do Mercado Envios
- [ ] **Fulfillment (Full)** — Gestão de estoque separada (seller vs centro Full)
- [ ] **Tendências** — Mostrar produtos em alta para oportunidades de venda
- [ ] **Predição de Categoria** — Sugerir categoria ao criar anúncio novo
- [ ] **Financeiro** — Extrato e movimentações do Mercado Pago
- [ ] **Estimativa de Frete** — Calcular frete por CEP para precificação
