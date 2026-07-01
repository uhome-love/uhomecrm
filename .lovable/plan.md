## Problema

O widget **"Leads a estagnar"** no dashboard do corretor (`/corretor`):

1. **Não atualiza** — continua mostrando leads como "a estagnar" mesmo depois que o corretor age no pipeline (cria tarefa futura ou registra ação). Confirmei **11 leads presos** nessa condição.
2. **Mostra cedo demais** — hoje lista qualquer lead na janela de **5 dias**, gerando ruído. O corretor quer o aviso **só quando faltam ~48h** (aviso final); fora disso, não tratar como urgência.

## Causa raiz (item 1)

Inconsistência de ordem de lógica entre a RPC do widget e a do modal do lead:

- Modal (`get_lead_estagnacao_status`): checa **primeiro** tarefa futura / ação recente → marca "protegido" e ignora aviso antigo. ✅
- Widget (`get_corretor_pre_estagnacao`): checa **primeiro** os campos persistidos `estagnado_aviso_em` / `estagnado_prazo_em`. Se o aviso foi gravado antes, ele vence a lógica e mostra "a estagnar" mesmo com tarefa/ação posterior. ❌

Os campos de aviso só são limpos quando o cron `processar_estagnacao_pipeline` roda. Entre execuções, o widget fica defasado — pipeline e modal já mostram certo.

```text
Aviso 19:12 -> estagnado_aviso_em/prazo_em gravados
Corretor cria tarefa 22:04
   Modal  -> "protegido"   OK
   Widget -> "a estagnar"  BUG
```

## Correção

**1. Corrigir a RPC `get_corretor_pre_estagnacao` (migration)**

- Aplicar a mesma prioridade do modal: revivência (tarefa pendente futura OU ação humana mais recente que o aviso) tem precedência sobre o aviso persistido. O ramo `em_aviso` só vale quando `estagnado_aviso_em IS NOT NULL AND estagnado_prazo_em > now()` **E** o lead **não** tem tarefa futura **E** `ref` não é posterior ao aviso.
- **Restringir a janela do widget para só 48h**: em vez do filtro atual `WHERE prazo_real <= now() + interval '5 days'`, mostrar apenas leads em urgência real, ou seja:
  - leads em **aviso final ativo** (`estagnado_aviso_em` válido, dentro das 48h), ou
  - leads cujo `prazo_real` já venceu / vence em até 48h (`prazo_real <= now() + interval '48 hours'`).
  - Leads com folga (>48h) **não aparecem** no widget.
- A `categoria` passa a ser `em_aviso` quando estiver no aviso final de 48h e `proximo` apenas para o caso de já estar no limite (<=48h) sem aviso formal.

**2. Limpeza pontual dos leads já presos (mesma migration)**
Rodar o `UPDATE` de ressurreição do cron para zerar `estagnado_aviso_em / estagnado_aviso2_em / estagnado_prazo_em` nos leads não-estagnados que já têm tarefa futura ou ação posterior ao aviso — efeito imediato, sem esperar o cron.

Sem alteração de regras de negócio, prazos ou cron. O componente `PreEstagnacaoCard.tsx` não muda (a query e o `staleTime` de 60s já refazem o fetch ao focar a tela) — a mudança é puramente na RPC.

## Validação

- `leads_presos_no_widget` deve ir de **11 → 0**.
- Widget passa a listar **apenas** leads dentro de 48h do prazo; leads com folga somem.
- Leads "protegido/atualizado" no modal não aparecem mais no widget.

## Detalhes técnicos

- Arquivo único: uma migration SQL (`CREATE OR REPLACE FUNCTION public.get_corretor_pre_estagnacao` + `UPDATE` de limpeza).
- Assinatura de retorno da função permanece idêntica → sem impacto no frontend/tipos.
- Uma única migration (respeita o limite diário no horário comercial).
