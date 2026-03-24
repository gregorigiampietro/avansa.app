# PRD — Avansa (avansa.app)

## Visão Geral

**Avansa** é um SaaS de gestão para vendedores do Mercado Livre. Permite conectar uma ou múltiplas contas do ML em uma única interface, oferecendo controle de estoque, cálculo de custos/margem de lucro, gestão de vendas e modificações em massa nos anúncios.

**Domínio:** avansa.app
**Stack:** Next.js 14 (App Router) + Supabase + Tailwind CSS + shadcn/ui
**Deploy:** Vercel

---

## Problema

Vendedores do Mercado Livre — especialmente os que operam múltiplas contas — não possuem uma ferramenta unificada para:

- Visualizar estoque consolidado entre contas
- Calcular margem real de lucro (preço de venda - custo do produto - comissão ML - frete)
- Fazer alterações em massa (preço, estoque, status) sem entrar conta por conta
- Ter um dashboard financeiro com visão de P&L por produto e por conta

O painel nativo do ML é limitado: não permite inserir custo de aquisição, não consolida múltiplas contas e não calcula margem líquida.

---

## Personas

### Persona 1 — Revendedor Solo
- Opera 1-3 contas no ML
- Revende produtos comprados de fornecedores
- Precisa saber se está tendo lucro real por produto
- Faz tudo manualmente hoje (planilha)

### Persona 2 — Operação Profissional
- Opera 3-10+ contas no ML
- Equipe pequena (2-5 pessoas)
- Precisa de visão consolidada e controle de estoque entre contas
- Volume alto de SKUs (100+)

---

## Funcionalidades — MVP (v1.0)

### 1. Autenticação do Avansa
- Login/cadastro via email + senha (Supabase Auth)
- Possibilidade futura: login social (Google)
- Cada usuário do Avansa pode conectar N contas do Mercado Livre

### 2. Conexão de Contas ML (OAuth)
- Botão "Conectar conta do Mercado Livre"
- Fluxo OAuth 2.0 com PKCE
- Suporte a múltiplas contas por usuário
- Exibir status de cada conta conectada (ativa, token expirado, erro)
- Renovação automática de tokens (access_token expira em 6h, refresh via refresh_token)
- Botão para desconectar conta

### 3. Dashboard Principal
- Visão geral consolidada de todas as contas:
  - Total de anúncios ativos
  - Total de vendas (hoje / 7d / 30d)
  - Faturamento bruto
  - Lucro líquido estimado
  - Margem média
- Filtro por conta ML
- Filtro por período

### 4. Gestão de Produtos / Anúncios
- Lista de todos os anúncios de todas as contas conectadas
- Para cada anúncio exibir:
  - Título, foto, SKU
  - Conta ML de origem
  - Preço de venda atual
  - Estoque disponível
  - Custo do produto (inputado pelo usuário)
  - Comissão ML (calculada via API listing_prices)
  - Custo de frete estimado
  - **Margem líquida** = Preço - Custo - Comissão - Frete
  - Status (ativo, pausado, finalizado)
  - Saúde do anúncio (healthy, warning, unhealthy)
- Busca e filtros (por conta, categoria, status, margem, estoque baixo)
- Ordenação (por margem, vendas, estoque)

### 5. Edição de Produtos
- Edição individual:
  - Alterar preço
  - Alterar estoque
  - Pausar / Reativar anúncio
- Edição em massa:
  - Selecionar múltiplos anúncios
  - Alterar preço (valor fixo ou percentual)
  - Alterar estoque
  - Pausar / Reativar em lote
- Todas as edições via API do ML com feedback de sucesso/erro

### 6. Cadastro de Custos
- Para cada produto, o usuário pode cadastrar:
  - Custo de aquisição (R$)
  - Custo de embalagem (R$) — opcional
  - Outros custos fixos (R$) — opcional
- O sistema calcula automaticamente a margem com base nesses dados + comissão ML + frete
- Importação de custos via CSV (opcional no MVP)

### 7. Gestão de Vendas
- Lista de pedidos (orders) de todas as contas
- Para cada pedido:
  - Produto(s), quantidade, preço unitário
  - Comprador (nome, cidade)
  - Status do pedido
  - Status do pagamento
  - Status do envio
  - Lucro líquido da venda
- Filtro por conta, período, status
- Exportação CSV

### 8. Notificações / Webhooks
- Receber webhooks do ML para:
  - Novas vendas
  - Alterações de status de pedidos
  - Alterações em anúncios
  - Perguntas de compradores
- Processar e atualizar dados no banco em tempo real
- Notificação in-app para eventos importantes (venda nova, estoque zerou)

---

## Funcionalidades — Futuras (v2.0+)

- Responder perguntas de compradores pelo Avansa
- Alertas de estoque baixo (configurável por produto)
- Simulador de preço (input: margem desejada → output: preço sugerido)
- Relatório de P&L mensal por conta e consolidado
- Comparativo de performance entre contas
- Gestão de promoções
- Clonagem de anúncios entre contas
- Sincronização de estoque entre anúncios do mesmo SKU em contas diferentes
- Integração com Mercado Ads (campanhas, ROI)
- App mobile (React Native)

---

## Arquitetura Técnica

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend/API | Next.js API Routes (Route Handlers) |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/senha) |
| OAuth ML | Custom implementation via Route Handlers |
| Hosting | Vercel |
| Domínio | avansa.app |

### Fluxo OAuth do Mercado Livre

```
Usuário clica "Conectar conta ML"
    ↓
Frontend gera code_verifier + code_challenge (PKCE)
Salva code_verifier na session/cookie
    ↓
Redireciona para:
https://auth.mercadolibre.com/authorization
  ?response_type=code
  &client_id=APP_ID
  &redirect_uri=https://avansa.app/api/auth/mercadolivre/callback
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256
    ↓
Usuário faz login no ML e autoriza
    ↓
ML redireciona para callback com ?code=TG-xxxxx
    ↓
Route Handler POST para https://api.mercadolibre.com/oauth/token
  com code + client_secret + code_verifier
    ↓
Recebe: access_token, refresh_token, user_id, expires_in
    ↓
Salva tokens criptografados no Supabase (tabela ml_accounts)
Busca dados do user ML (GET /users/me) para pegar nickname, etc.
    ↓
Redireciona para /dashboard com conta conectada
```

### Renovação de Token

- access_token expira em 6 horas
- Antes de cada chamada à API do ML, verificar se token está próximo de expirar
- Se sim, fazer refresh via POST /oauth/token com grant_type=refresh_token
- Atualizar tokens no banco
- Alternativa: CRON job via Vercel Cron ou Supabase Edge Function a cada 5 horas

### Endpoints ML utilizados

| Recurso | Método | Endpoint | Uso |
|---|---|---|---|
| Dados do usuário | GET | /users/me | Info da conta conectada |
| Listar anúncios | GET | /users/{user_id}/items/search | Todos os itens do vendedor |
| Detalhe do item | GET | /items/{item_id} | Info completa do anúncio |
| Multi-get itens | GET | /items?ids=id1,id2,... | Buscar até 20 itens por vez |
| Preço do item | GET | /items/{item_id}/prices | Preço standard e promoções |
| Atualizar item | PUT | /items/{item_id} | Editar preço, estoque, status |
| Custos/comissão | GET | /sites/MLB/listing_prices?price=X&listing_type_id=Y | Calcular comissão |
| Pedidos | GET | /orders/search?seller={user_id} | Listar vendas |
| Detalhe pedido | GET | /orders/{order_id} | Info completa da venda |
| Envios | GET | /shipments/{shipment_id} | Status de entrega |
| Perguntas | GET | /questions/search?seller_id={user_id} | Perguntas recebidas |
| Categorias | GET | /categories/{category_id} | Info de categoria |
| Notificações | POST (webhook) | Recebido em /api/webhooks/mercadolivre | Eventos em tempo real |

### Base URL da API

- API principal: `https://api.mercadolibre.com`
- Autenticação: `https://auth.mercadolibre.com`
- Site ID Brasil: `MLB`

---

## Database Schema (Supabase / PostgreSQL)

### Tabela: users
Gerenciada pelo Supabase Auth. Campos default (id, email, created_at, etc.)

### Tabela: ml_accounts
```sql
CREATE TABLE ml_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml_user_id BIGINT NOT NULL,
  nickname TEXT,
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, error, disconnected
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ml_user_id)
);
```

### Tabela: products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  ml_item_id TEXT NOT NULL, -- ex: MLB1234567890
  title TEXT,
  thumbnail TEXT,
  category_id TEXT,
  status TEXT, -- active, paused, closed, under_review
  listing_type TEXT, -- gold_special, gold_pro, free
  price DECIMAL(12,2),
  available_quantity INTEGER,
  sold_quantity INTEGER,
  permalink TEXT,
  sku TEXT,
  health TEXT, -- healthy, warning, unhealthy
  condition TEXT, -- new, used
  -- Custos (inputados pelo usuário)
  cost_price DECIMAL(12,2), -- custo de aquisição
  packaging_cost DECIMAL(12,2) DEFAULT 0, -- custo de embalagem
  other_costs DECIMAL(12,2) DEFAULT 0, -- outros custos
  -- Calculados
  ml_fee DECIMAL(12,2), -- comissão ML
  shipping_cost DECIMAL(12,2), -- custo de frete
  net_margin DECIMAL(12,2), -- margem líquida calculada
  margin_percent DECIMAL(5,2), -- margem %
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ml_account_id, ml_item_id)
);
```

### Tabela: orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  ml_order_id BIGINT NOT NULL,
  status TEXT, -- confirmed, payment_required, paid, cancelled
  date_created TIMESTAMPTZ,
  date_closed TIMESTAMPTZ,
  total_amount DECIMAL(12,2),
  currency_id TEXT DEFAULT 'BRL',
  buyer_id BIGINT,
  buyer_nickname TEXT,
  -- Dados do item vendido
  ml_item_id TEXT,
  item_title TEXT,
  quantity INTEGER,
  unit_price DECIMAL(12,2),
  sku TEXT,
  -- Envio
  shipping_id BIGINT,
  shipping_status TEXT,
  shipping_cost DECIMAL(12,2),
  -- Financeiro
  payment_status TEXT,
  payment_type TEXT,
  ml_fee DECIMAL(12,2),
  cost_price DECIMAL(12,2), -- puxado do cadastro de produtos
  net_profit DECIMAL(12,2), -- lucro líquido calculado
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ml_account_id, ml_order_id)
);
```

### Tabela: webhook_events
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL, -- orders_v2, items, questions, etc.
  resource TEXT NOT NULL, -- /orders/123456
  ml_user_id BIGINT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  payload JSONB
);
```

### Tabela: sync_logs
```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID REFERENCES ml_accounts(id),
  sync_type TEXT, -- full_sync, incremental, webhook
  status TEXT, -- running, completed, error
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

---

## Estrutura de Pastas (Next.js App Router)

```
avansa/
├── .env.local                    # Variáveis de ambiente (não commitar)
├── CLAUDE.md                     # Contexto para Claude Code
├── PRD.md                        # Este documento
├── next.config.js
├── tailwind.config.ts
├── package.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Layout raiz (providers, sidebar)
│   │   ├── page.tsx              # Landing page / redirect para dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Layout com sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx      # Lista de produtos
│   │   │   │   └── [id]/page.tsx # Detalhe do produto
│   │   │   ├── orders/page.tsx   # Lista de vendas
│   │   │   ├── accounts/page.tsx # Gerenciar contas ML
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── mercadolivre/
│   │       │       ├── authorize/route.ts  # Inicia OAuth
│   │       │       └── callback/route.ts   # Recebe code
│   │       ├── webhooks/
│   │       │   └── mercadolivre/route.ts   # Recebe notificações
│   │       ├── ml/
│   │       │   ├── sync/route.ts           # Sync manual
│   │       │   ├── products/route.ts       # CRUD produtos
│   │       │   └── orders/route.ts         # Consultar vendas
│   │       └── cron/
│   │           └── refresh-tokens/route.ts # Renovar tokens
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Client-side Supabase
│   │   │   ├── server.ts         # Server-side Supabase
│   │   │   └── admin.ts          # Service role (para webhooks)
│   │   ├── mercadolivre/
│   │   │   ├── api.ts            # Wrapper da API do ML
│   │   │   ├── oauth.ts          # Funções OAuth (authorize, token, refresh)
│   │   │   ├── sync.ts           # Lógica de sincronização
│   │   │   └── types.ts          # TypeScript types da API ML
│   │   └── utils/
│   │       ├── calculations.ts   # Cálculos de margem, lucro
│   │       └── formatters.ts     # Formatação de moeda, datas
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── stats-cards.tsx
│   │   │   ├── revenue-chart.tsx
│   │   │   └── recent-orders.tsx
│   │   ├── products/
│   │   │   ├── product-table.tsx
│   │   │   ├── product-card.tsx
│   │   │   ├── cost-editor.tsx
│   │   │   └── bulk-actions.tsx
│   │   ├── orders/
│   │   │   └── order-table.tsx
│   │   ├── accounts/
│   │   │   ├── account-card.tsx
│   │   │   └── connect-button.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── header.tsx
│   │       └── account-switcher.tsx
│   ├── hooks/
│   │   ├── use-ml-accounts.ts
│   │   ├── use-products.ts
│   │   └── use-orders.ts
│   └── types/
│       ├── database.ts           # Types gerados do Supabase
│       └── mercadolivre.ts       # Types da API ML
```

---

## Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yunshbkjklygdyscazin.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1bnNoYmtqa2x5Z2R5c2NhemluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQzMDYsImV4cCI6MjA4OTI4MDMwNn0.XdAzzc_wVoNItjPUq-AT4a_e4Fue7stHuBQpZgImDfM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1bnNoYmtqa2x5Z2R5c2NhemluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcwNDMwNiwiZXhwIjoyMDg5MjgwMzA2fQ.8Jf6sDvWSOPy7WoYRj0MQFrC9lrmiI4xtzaufqjmBDw

# Mercado Livre
ML_APP_ID=3227566478967371
ML_CLIENT_SECRET=ErX8kDWbM91ugUcoLTjgLC8CW0HIeLDz
ML_REDIRECT_URI=https://avansa.app/api/auth/mercadolivre/callback

# App
NEXT_PUBLIC_APP_URL=https://avansa.app
CRON_SECRET=  # Para proteger endpoints de cron
```

---

## Regras de Negócio

### Cálculo de Margem
```
margem_liquida = preco_venda - custo_produto - embalagem - outros_custos - comissao_ml - custo_frete
margem_percent = (margem_liquida / preco_venda) * 100
```

### Sincronização de Dados
- **Full sync:** Executado ao conectar uma conta pela primeira vez. Puxa todos os anúncios ativos.
- **Incremental sync:** Via webhooks + polling periódico (a cada 15min via Vercel Cron).
- **Multi-get:** Usar endpoint /items?ids= para buscar até 20 itens por vez (otimizar chamadas).

### Rate Limiting
- Implementar retry com exponential backoff para erros 429 da API do ML.
- Respeitar limite de chamadas (não documentado oficialmente, mas ~10k/hora é seguro).

### Segurança
- Tokens do ML armazenados criptografados no banco (usar pgcrypto ou encrypt no app layer).
- Webhooks do ML validados pelo user_id (confirmar que o evento pertence a uma conta conectada).
- RLS (Row Level Security) do Supabase habilitado em todas as tabelas.
- CRON endpoints protegidos com CRON_SECRET.

### Design System
- Extraia o design system do aplicativo do arquivo @design-system.html
- Analise e crie o próprio design system do aplicativo
- use o MCP do shadcn para buscar sempre os components ao invés de ficar criando
- Quando nao houve o componente no shadcn, crie se preciso for 