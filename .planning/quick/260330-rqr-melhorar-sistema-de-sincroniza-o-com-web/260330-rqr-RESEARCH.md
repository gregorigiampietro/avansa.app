# Research: Melhorar sistema de sincronização com webhooks ML

**Date:** 2026-03-30

## 1. ML Webhooks — Como funciona

### Configuração
- Feita no Application Manager do ML (UI, não API)
- Callback URL: `https://avansa.app/api/webhooks/mercadolivre`
- Tópicos relevantes: `marketplace orders`, `items`, `marketplace shipments`

### Payload recebido (POST)
```json
{
  "_id": "5da8a1b24be30a49eb66c52a",
  "resource": "/orders/1499111111",
  "user_id": 123456789,
  "topic": "orders_v2",
  "application_id": 2069392825111111,
  "attempts": 1,
  "sent": "2019-10-09T13:58:23.347Z",
  "received": "2019-10-09T13:58:23.329Z"
}
```

### Regras críticas
- **Responder 200 em 500ms** — senão ML desabilita os tópicos
- Retries: intervalos exponenciais → 1h → descarta
- Payload tem APENAS referência — fazer GET no resource com token do user_id

### Estado atual do código
O endpoint `/api/webhooks/mercadolivre/route.ts` já:
- Salva evento no DB → responde 200 → processa async (fire-and-forget)
- Processa `orders_v2` (upsert de order) e `items` (update produto)

### Problemas encontrados
1. **Sem deduplicação** — mesmo evento pode ser processado N vezes
2. **Items webhook incompleto** — não refaz cálculo de fees/shipping/margin
3. **Sem retry de falhas** — erro marca como processado (perde o evento)
4. **Sem validação de assinatura** — qualquer POST é aceito

## 2. Estratégia de deduplicação

**Abordagem: campo `_id` do payload + unique constraint**

O ML envia `_id` no payload. Adicionar coluna `ml_notification_id` no webhook_events com unique constraint. No INSERT, usar `ON CONFLICT DO NOTHING` — se já existe, ignorar.

Alternativa simples: verificar se `resource + topic + sent` já existe antes de processar.

**Recomendação:** Usar `_id` do payload como `ml_notification_id` — é a forma mais robusta.

## 3. Retry de falhas

**Abordagem: status separado + cron de retry**

Campos no webhook_events:
- `status`: 'pending' → 'processing' → 'completed' | 'error'
- `error_message`: texto do erro
- `retry_count`: int (max 3)

Cron de retry (ou aproveitar cron existente de 6h):
1. Buscar eventos com `status = 'error' AND retry_count < 3`
2. Reprocessar cada um
3. Incrementar retry_count

**Recomendação:** Não criar cron separado. Adicionar uma etapa no cron de sync-data existente que reprocessa webhooks com erro.

## 4. Items webhook — processar completo

Atualmente o item webhook só atualiza campos básicos (price, quantity, status). Faltam:
- ML fees (via `/sites/MLB/listing_prices`)
- Shipping cost (via `/items/{id}/shipping_options`)
- Recálculo de margin

**Fix:** Quando webhook de item chega, buscar dados completos como o sync manual faz. Reutilizar funções existentes de `sync.ts`.

## 5. Sync incremental

### Para produtos (sync manual):
- Guardar `last_synced_at` por conta
- Na API ML: usar `/users/{id}/items/search?last_updated.from={date}` para buscar apenas itens modificados desde o último sync
- Se nenhum item modificado, skip

### Para orders (sync manual):
- API ML suporta `date_created.from` e `last_updated.from`
- Buscar orders com `date_created.from={last_sync_date}`

### Limitação:
- Items search não suporta `last_updated.from` diretamente — mas podemos comparar IDs retornados com DB
- Abordagem pragmática: buscar todos os IDs (rápido, ~50 por página), comparar com DB, só fazer multi-get dos que são novos ou cujo `last_updated` é mais recente

## 6. Feedback visual de sync

### Recomendação: Indicador simples + mini painel

**Header/sidebar badge:**
- "Atualizado há X min" com ícone de check verde
- Ícone de sync girando quando sync em andamento

**Na página de cada tipo (produtos, vendas):**
- Texto "Última sincronização: DD/MM/YYYY HH:mm"
- Badge de status: "Automático" (webhook ativo) ou "Manual" (sem webhook recente)

**Como detectar webhook ativo:**
- Contar webhook_events processados nas últimas 24h para a conta
- Se > 0 → "Automático" (webhook funcionando)
- Se 0 → "Manual" (webhook pode estar desconfigurado)

### Dados necessários:
- Query: último sync_log por tipo por conta
- Query: contagem de webhook_events recentes por conta

### API endpoint novo:
`GET /api/ml/sync-status` → retorna último sync por tipo + status webhook

## 7. Escopo recomendado para o quick task

Dividir em 3 plans:

**Plan 1: Robustez do webhook**
- Deduplicação com ml_notification_id
- Status de erro separado (pending/processing/completed/error)
- Retry de falhas no cron existente
- Items webhook completo (fees + shipping + margin)

**Plan 2: Sync incremental + API de status**
- Sync incremental de produtos (comparar IDs, multi-get só os novos/atualizados)
- Sync incremental de orders (date_created.from)
- Novo endpoint GET /api/ml/sync-status

**Plan 3: Feedback visual na UI**
- Componente SyncStatusIndicator no header/sidebar
- "Última sincronização" por página
- Badge "Automático"/"Manual" por conta
