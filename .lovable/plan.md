# Plano: Correção do Caso Thalia / Luiz - Bloquear redistribuição de leads já reativados

## 1. O que aconteceu com a Thalia (comprovado pelos dados)

A Thalia enviou mensagem no WhatsApp às 15:03 dizendo que aprovou o lead **Luiz (5384313481)**, mas ele não foi para ela.

### 1.1 Timeline real do lead Luiz

| Horário | Evento | Responsável | Situação |
|---|---|---|---|
| 17:38 | Lead servido no Mutirão e **pulado** | Marcos Aurelio Farias | Lead apareceu para outro corretor |
| 18:06 | Lead servido no Mutirão e marcado **sem interesse** com observação: *"já está falando com a Thalia"* | Andressa Madril | Lead apareceu para outro corretor novamente |
| 18:25 | Lead movido de **Novo Lead** para **Qualificação** por Thalia | Thalia de Oliveira | Lead finalmente atribuído a ela no CRM |

### 1.2 Estado atual do lead

| Campo | Valor |
|---|---|
| Nome | Luiz |
| Telefone | 5384313481 |
| Corretor atual | Thalia de Oliveira (auth id `c882b90d...`) |
| Stage | Qualificação (`1ea43190...`) |
| Arquivado | `false` |
| Aceite | `aceito` |

**Conclusão**: o lead **está** no CRM da Thalia agora. O que ela sentiu foi o atraso entre o momento em que ela achou que aprovou (15:03) e o momento real da movimentação (18:25), além do fato de que o lead foi oferecido a outros corretores enquanto ela já estava com ele.

## 2. Causa raiz do problema

O lead Luiz foi inserido na fila do Mutirão porque estava no stage de **Descarte** e arquivado. Ele foi servido para **Marcos** e depois para **Andressa** porque o mecanismo de lock do Mutirão **não verifica se o lead ainda está arquivado / no stage de descarte no momento de servir**.

Ou seja: o lead foi reativado manualmente (ou por outro fluxo) e movido para a Thalia, mas ainda continuava na `oferta_ativa_fila` como candidato. A fila não se atualiza quando o lead deixa de ser elegível.

## 3. Plano de correção

### 3.1 Garantir que a fila só sirva leads ainda elegíveis

No RPC `public.oferta_ativa_lock_next_lead` e na função `oferta-ativa-proximo-lead`, adicionar verificação no momento do lock:

- O lead deve estar `arquivado = true` **OU** no stage de **Descarte** (`1dd66c25-3848-4053-9f66-82e902989b4d`).
- Se o lead foi reativado (arquivado = false e stage ≠ Descarte), ele **não pode ser servido** e deve ser removido da fila.

### 3.2 Trigger de limpeza automática da fila

Criar um trigger `AFTER UPDATE` em `pipeline_leads` que, quando um lead for reativado (arquivado muda de `true` para `false` ou stage sai de Descarte), remove automaticamente todas as entradas daquele `pipeline_lead_id` em `oferta_ativa_fila` de sessões ativas.

Isso garante que, se a Thalia (ou qualquer outro corretor) reativar um lead por qualquer caminho, ele suma imediatamente do Mutirão.

### 3.3 Reforço anti-duplicação (já solicitado pelo usuário)

- Manter o lock de 15 minutos e cooldown de 2h para "não atendeu".
- Garantir que telefones não sejam duplicados na fila da mesma sessão.
- Adicionar proteção para não servir lead cujo telefone já tenha um lead ativo atribuído a outro corretor.

### 3.4 Notificação ao corretor quando aproveita um lead (NOVO)

Quando um corretor clicar em **Aproveitar** no Mutirão, mostrar notificação/toast claro:

> **"Lead aproveitado — foi para o seu pipeline na etapa [Nome da Etapa]"**

Exemplos de etapas:
- Lead novo → "Novo Lead"
- Reativado de descarte → "Novo Lead" (ou "Qualificação", dependendo da regra atual)
- Aproveitado com visita agendada → "Visita"

A notificação deve ajudar o corretor a **localizar** o lead no CRM. Pode incluir um botão de ação **"Abrir no Pipeline"** que navega para o lead.

**Onde implementar**:
- Edge function `oferta-ativa-historico-reaproveitar` (action `aproveitar`) e `oferta-ativa-registrar-resultado` (resultado `aproveitado` / `visita_agendada`) devem retornar a etapa/estágio de destino no payload.
- Frontend: `HistoricoPanel.tsx`, `useMutiraoSession.ts` e `LeadCard.tsx` devem exibir o toast de sucesso com o nome da etapa.

### 3.5 Melhoria de feedback quando lead já foi aproveitado

Quando um corretor tentar aproveitar um lead que já foi reativado por outro corretor, mostrar mensagem clara: "Este lead já foi aproveitado por outro corretor".

## 4. Backfill / ajustes imediatos

1. Remover da `oferta_ativa_fila` da sessão ativa todos os leads que já estão reativados (`arquivado = false` e stage ≠ Descarte).
2. Verificar se existem outros leads na fila que já têm corretor ativo e/ou estão em stages ativos do pipeline.

## 5. Arquivos / objetos que serão alterados

- `supabase/functions/oferta-ativa-proximo-lead/index.ts`
- Função `public.oferta_ativa_lock_next_lead` (via migration)
- Trigger `trg_oferta_ativa_fila_cleanup` em `pipeline_leads` (via migration)
- `supabase/functions/oferta-ativa-historico-reaproveitar/index.ts`
- `supabase/functions/oferta-ativa-registrar-resultado/index.ts`
- `src/components/oferta-ativa-ao-vivo/HistoricoPanel.tsx`
- `src/hooks/useMutiraoSession.ts`
- `src/components/oferta-ativa-ao-vivo/LeadCard.tsx` (toast de aproveitamento)
- `src/lib/leadHelpers.ts` (resolver nome da etapa por stage_id)

## 6. Critérios de pronto

- [ ] Lead reativado por qualquer caminho desaparece da fila do Mutirão em até poucos segundos.
- [ ] O lead Luiz não seria mais servido para Marcos/Andressa após ser reativado pela Thalia.
- [ ] Mensagem clara quando um corretor tenta aproveitar lead já reativado.
- [ ] Toast de aprovação informa a etapa de destino do lead ("Novo Lead", "Qualificação", "Visita", etc.).
- [ ] Nenhuma regressão no fluxo de lock, aproveitamento e visita agendada.
- [ ] Teste ao vivo com um lead de descarte: reativar manualmente e confirmar que não aparece mais no Mutirão.

## 7. Decisão do produto

A regra de negócio fica assim: **o Mutirão só pode servir leads que ainda estão descartados/arquivados. Assim que o lead é reativado (por qualquer caminho), ele deve sumir da fila.** Isso evita ligações duplicadas e a sensação de "já estou falando com esse cliente".

---

**Aguardo aprovação para implementar.**