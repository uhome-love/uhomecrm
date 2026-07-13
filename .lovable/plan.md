## Objetivo

1. Deixar a **Fila de reenvio** recolhida **por base** (agrupada por template/empreendimento), na aba "Ao vivo".
2. **Liberar o reenvio** agora que o pagamento pendente na Meta foi regularizado.
3. Fazer as validações para deixar **100% funcional**.

## Contexto atual (investigado no banco)

- Travas de emergência ligadas: `system_flags.campaign_dispatch_enabled=false` e `reengajamento_config.paused=true`.
- **20.009 disparos com `status='failed'`**, distribuídos em 11 bases (template): casatua_maio (6.073), casatua_junho25k (4.566), reativacao_opcoes_perfil_v2 (4.438), etc.
- As falhas recentes trazem `Business eligibility payment issue`. Hoje o retry recusa exatamente essas falhas via `isQualityBlockingError` — então, mesmo reativando o gate, os itens que você quer reenviar ficariam travados. Isso precisa mudar.
- O card atual busca só 300 linhas e agrupa por telefone, não por base — some parte das falhas.

## O que será feito

### 1. Reativar o disparo (dados — pagamento regularizado)
- `system_flags.campaign_dispatch_enabled = true`, com `reason` = "Pagamento Meta regularizado 13/07 — reenvio liberado".
- `reengajamento_config.paused = false`, limpando o `paused_reason`.
- (Não reabro nenhuma run automaticamente; o disparo volta a acontecer apenas por ação manual na fila/reenvio.)

### 2. Fila de reenvio recolhida por base (UI — `FilaReenvioCard.tsx`)
Reescrever o card para listar **uma linha recolhida por base (template)**:
- Cada base mostra: nome do template, nº de falhas, nº de telefones distintos, data da última falha e o motivo predominante.
- Botão **"Tentar base"** por linha (reenvia todas as falhas daquela base) e um **"Tentar todas as bases"** no topo.
- Ao **expandir** uma base, carrega sob demanda os leads daquela base (telefone, nome, template, motivo, quando) com botão "Tentar" individual — usando `Accordion` do shadcn.
- Banner de bloqueio passa a refletir **o gate global** (lê `system_flags.campaign_dispatch_enabled`), não mais o texto de erro: quando o motor está ligado, os botões ficam habilitados; quando desligado, aparece o aviso e os botões desabilitam.

### 3. Agregação por base (backend)
- Criar função RPC `get_reengajamento_fila_bases()` (SECURITY DEFINER) que retorna, para `status='failed'` com `run_id` não nulo, o agregado por `template_name`: total, telefones distintos, última falha, motivo predominante. Isso evita puxar 20 mil linhas no cliente.
- O detalhamento de uma base (leads) continua via consulta direta filtrando por `template_name` com `limit`.

### 4. Liberar o reenvio das falhas de elegibilidade/cobrança (edge `reengajamento-retry-falhas`)
- Como o pagamento foi regularizado, o retry deve **passar a reenviar** as falhas `Business eligibility payment issue`/elegibilidade quando o **gate global estiver ligado** (o gate ligado é o sinal humano de "conta saudável").
- Mudança: o retry deixa de recusar por `eligibility/payment/cobrança`. Mantém a checagem do **gate global** (se desligado, bloqueia) e mantém apenas um alerta informativo para throttle `131049`, sem travar quando o usuário liberou.
- Aceitar também reenvio **por base**: `body.template_name` (além de `meta_ids`), selecionando as falhas daquele template.

### 5. Validações (deixar 100%)
- `tsgo` (typecheck) e a suíte de testes atual (`vitest`).
- Testar a edge `reengajamento-retry-falhas` via chamada autenticada (gate ligado → reprocessa; conferir `reset`/`runs`).
- Conferir no banco que os itens reenviados voltaram para `pending` na `reengajamento_dispatch_queue` e que as falhas viraram `retried`.
- Conferir na UI (preview) que a fila aparece recolhida por base, expande e os botões estão habilitados com o gate ligado.

## Detalhes técnicos
- Sem alteração nas travas globais além de ligar o gate e despausar a config.
- RPC nova em migration (função SECURITY DEFINER, `search_path=public`); sem novas tabelas.
- `FilaReenvioCard` usa `Accordion` (shadcn) já disponível; mantém layout desktop (tabela ao expandir) e mobile (cards).
- Memória `mem://features/whatsapp/reengajamento-parado-spam-meta` será atualizada para registrar a reativação pós-pagamento e que o retry passa a ser governado pelo gate global.
