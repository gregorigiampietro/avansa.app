# CLAUDE.md — Avansa

## Projeto

Avansa (avansa.app) é um SaaS de gestão para vendedores do Mercado Livre. Permite conectar múltiplas contas ML via OAuth, visualizar estoque, calcular margem de lucro e fazer edições em massa.

## Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL com RLS)
- **Auth:** Supabase Auth (email/senha)
- **OAuth ML:** Custom (OAuth 2.0 + PKCE)
- **Deploy:** Vercel
- **Domínio:** avansa.app

## Convenções de Código

- TypeScript strict em tudo
- Server Components por padrão; "use client" apenas quando necessário (hooks, interatividade)
- API routes via Route Handlers (src/app/api/)
- Supabase client-side: `@supabase/ssr` com `createBrowserClient`
- Supabase server-side: `createServerClient` com cookies
- Supabase admin (webhooks/cron): `createClient` com service_role_key
- Nomenclatura de arquivos: kebab-case (ex: `product-table.tsx`)
- Componentes: PascalCase (ex: `ProductTable`)
- Variáveis/funções: camelCase
- Types em arquivos separados: `src/types/`
- Sempre usar `async/await`, nunca `.then()`
- Tratar erros com try/catch e retornar mensagens claras ao usuário
- Textos da UI em português brasileiro

## Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ML_APP_ID=
ML_CLIENT_SECRET=
ML_REDIRECT_URI=https://avansa.app/api/auth/mercadolivre/callback
NEXT_PUBLIC_APP_URL=https://avansa.app
CRON_SECRET=
```

## API do Mercado Livre — Referência Rápida

### Base URLs
- API: `https://api.mercadolibre.com`
- Auth: `https://auth.mercadolibre.com`
- Site ID Brasil: `MLB`

### OAuth Flow (PKCE)
1. Gerar `code_verifier` (random 43-128 chars) e `code_challenge` (SHA-256 + base64url)
2. Redirecionar para: `https://auth.mercadolibre.com/authorization?response_type=code&client_id={APP_ID}&redirect_uri={REDIRECT_URI}&code_challenge={CODE_CHALLENGE}&code_challenge_method=S256`
3. Callback recebe `?code=TG-xxxxx`
4. Trocar code por token: POST `https://api.mercadolibre.com/oauth/token` com body:
   - `grant_type=authorization_code`
   - `client_id={APP_ID}`
   - `client_secret={CLIENT_SECRET}`
   - `code={CODE}`
   - `redirect_uri={REDIRECT_URI}`
   - `code_verifier={CODE_VERIFIER}`
5. Resposta: `{ access_token, token_type, expires_in (21600 = 6h), scope, user_id, refresh_token }`
6. Refresh: POST mesmo endpoint com `grant_type=refresh_token` + `refresh_token`

### Headers para chamadas autenticadas
```
Authorization: Bearer {access_token}
```

### Endpoints principais
| Ação | Método | Endpoint |
|---|---|---|
| Dados do user | GET | /users/me |
| Buscar itens do vendedor | GET | /users/{user_id}/items/search |
| Multi-get itens (até 20) | GET | /items?ids=MLB123,MLB456 |
| Detalhe item | GET | /items/{item_id} |
| Preço do item | GET | /items/{item_id}/prices |
| Atualizar item | PUT | /items/{item_id} |
| Calcular comissão | GET | /sites/MLB/listing_prices?price={price}&listing_type_id={type}&category_id={cat} |
| Buscar pedidos | GET | /orders/search?seller={user_id} |
| Detalhe pedido | GET | /orders/{order_id} |
| Envio | GET | /shipments/{shipment_id} |

### Atualizar estoque (PUT /items/{item_id})
```json
{ "available_quantity": 50 }
```

### Atualizar preço (PUT /items/{item_id})
```json
{ "price": 299.90 }
```

### Pausar anúncio (PUT /items/{item_id})
```json
{ "status": "paused" }
```

### Reativar anúncio (PUT /items/{item_id})
```json
{ "status": "active" }
```

### Buscar itens com filtros
```
GET /users/{user_id}/items/search?status=active&offset=0&limit=50
GET /users/{user_id}/items/search?seller_sku={SKU}
GET /users/{user_id}/items/search?reputation_health_gauge=unhealthy
```

### Webhook payload (POST recebido do ML)
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
O payload do webhook contém apenas a referência. Para obter os dados completos, fazer GET no resource com o access_token do user_id correspondente.

## Database Schema

Tabelas principais: `ml_accounts`, `products`, `orders`, `webhook_events`, `sync_logs`.
Schema completo no PRD.md — seção "Database Schema".

### RLS Policies (implementar em todas as tabelas)
- Users só acessam dados de suas próprias ml_accounts
- Policy base: `auth.uid() = user_id` na tabela ml_accounts
- Demais tabelas: join com ml_accounts para validar ownership

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/           → login, register
│   ├── (dashboard)/      → dashboard, products, orders, accounts, settings
│   └── api/
│       ├── auth/mercadolivre/   → authorize + callback (OAuth)
│       ├── webhooks/            → receber notificações ML
│       ├── ml/                  → sync, products, orders
│       └── cron/                → refresh-tokens
├── lib/
│   ├── supabase/         → client.ts, server.ts, admin.ts
│   ├── mercadolivre/     → api.ts, oauth.ts, sync.ts, types.ts
│   └── utils/            → calculations.ts, formatters.ts
├── components/
│   ├── ui/               → shadcn/ui
│   ├── dashboard/        → stats, charts
│   ├── products/         → tabelas, edição
│   ├── orders/           → tabelas de vendas
│   ├── accounts/         → cards de contas ML
│   └── layout/           → sidebar, header
├── hooks/                → custom hooks
└── types/                → database.ts, mercadolivre.ts
```

## Ordem de Implementação (build plan)

### Fase 1 — Fundação
1. Setup Next.js + Tailwind + shadcn/ui
2. Configurar Supabase (projeto, schema, RLS)
3. Auth pages (login/register)
4. Layout com sidebar

### Fase 2 — OAuth ML
5. Rota /api/auth/mercadolivre/authorize (gerar PKCE + redirect)
6. Rota /api/auth/mercadolivre/callback (trocar code → token, salvar)
7. Página /accounts (listar contas, botão conectar, status)
8. Middleware de refresh automático de token

### Fase 3 — Sync e Produtos
9. lib/mercadolivre/api.ts (wrapper com auto-refresh)
10. lib/mercadolivre/sync.ts (full sync de itens)
11. Página /products (tabela com todos os anúncios)
12. Cadastro de custos por produto
13. Cálculo de margem (comissão via listing_prices + custo)

### Fase 4 — Vendas e Dashboard
14. Sync de orders
15. Página /orders (tabela de vendas)
16. Dashboard com cards de métricas
17. Gráfico de faturamento/lucro

### Fase 5 — Edição e Webhooks
18. Edição individual (preço, estoque, status)
19. Edição em massa
20. Webhook endpoint + processamento
21. Vercel Cron para refresh de tokens

## Regras Importantes

- **Nunca** expor ML_CLIENT_SECRET no client-side
- **Sempre** verificar token antes de chamada à API ML; renovar se necessário
- **Multi-get**: usar /items?ids= com até 20 IDs por vez para otimizar
- **Webhooks**: responder 200 imediatamente e processar async
- **Margem**: preço - custo_produto - embalagem - outros_custos - comissão_ml - frete
- **RLS**: habilitar em TODAS as tabelas, sem exceção
- **Moeda**: sempre BRL, formato R$ X.XXX,XX
- **Datas**: timezone America/Sao_Paulo para exibição
- **Paginação da API ML**: usar offset + limit (max 50 por página)
- **Textos da UI**: tudo em português brasileiro
