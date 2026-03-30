# Quick Task 260330-rqr: Melhorar sistema de sincronização com webhooks ML - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Task Boundary

Melhorar o sistema de sincronização para funcionar automaticamente via webhooks ML, com sync incremental no botão manual, e feedback visual do status de sync na UI.

</domain>

<decisions>
## Implementation Decisions

### Sync automático via webhook
- O endpoint já existe em /api/webhooks/mercadolivre — melhorar a robustez
- Processar orders_v2 e items com dados completos (fees, shipping, margin)
- Deduplicar eventos (ML pode enviar o mesmo evento múltiplas vezes)
- Implementar retry para falhas (status separado de "error" vs "processed")
- Webhook processor de items deve refazer cálculo de fees + shipping (hoje não faz)

### Sync incremental
- Sync manual deve sincronizar apenas o que mudou desde o último sync
- Usar last_synced_at ou date range da API ML para filtrar
- Reduzir tempo de sync para sellers com muitos produtos

### Feedback visual de sync
- Mostrar na UI quando foi a última sincronização
- Indicar quando sync está em andamento
- Mostrar status de saúde do webhook (eventos recentes processados com sucesso?)

### Claude's Discretion
- Escolha entre indicador simples (badge "Atualizado há X min") ou painel dedicado — decidir baseado na complexidade
- Implementação de validação de assinatura ML (X-ML-Signature) — incluir se não adicionar muito escopo
- Formato exato de retry (exponential backoff, max attempts, etc.)
- Se usar polling ou websocket para feedback real-time na UI

</decisions>

<specifics>
## Specific Ideas

- ML exige resposta HTTP 200 em 500ms — processamento DEVE ser async
- ML tenta reenvio em intervalos exponenciais, depois a cada 1h, depois descarta
- Tópicos necessários: marketplace orders, items, marketplace shipments
- Webhook payload tem apenas a referência — precisa fazer GET no resource para dados completos
- Cron de 6h já existe como fallback — manter

</specifics>

<canonical_refs>
## Canonical References

- ML Notifications docs: configura callback URL + tópicos no Application Manager
- Order statuses: payment_required, payment_in_process, partially_paid, paid, cancelled, invalid
- Notification payload: { resource, user_id, topic, application_id, attempts, sent, received }
- Must return HTTP 200 within 500ms to prevent retries
- CLAUDE.md: webhook section com payload de exemplo

</canonical_refs>
