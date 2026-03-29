

## Implementar 5 Melhorias Prioritarias do Teste E2E

Baseado na auditoria completa, estas sao as melhorias ordenadas por impacto para o corretor.

---

### 1. StageCoachBar: Adicionar caso "Atendimento" + Follow-up 5 dias + Anti No-show

**Arquivo:** `src/components/pipeline/StageCoachBar.tsx`

O `StageCoachBar` nao tem casos especificos para a etapa mais critica (atendimento/contato_iniciado com lead parado). Melhorias:

- **Caso `contato_iniciado`**: Enriquecer com o framework UHOME (Relacionamento > Diagnostico > Oferta) e perguntas obrigatorias
- **Caso `visita_marcada`**: Adicionar sequencia Anti No-show (D-2: video, D-1: autoridade, Dia: lembrete+mapa) com mensagens prontas
- **Caso `visita_realizada`**: Reforcar regra "follow-up MESMO DIA"
- Mostrar badge `Dia X/5` quando `sequenceInfo` estiver disponivel (motor de follow-up 5 dias)
- Adicionar indicador visual de urgencia quando `diasSemContato >= 3` no contato_iniciado

### 2. HomiLeadAssistant: Campo "O que o cliente disse" + Link WhatsApp direto

**Arquivo:** `src/components/pipeline/HomiLeadAssistant.tsx`

- Adicionar campo de input "O que o cliente disse/respondeu?" nas acoes de WhatsApp para que a IA gere respostas baseadas na mensagem real do cliente (nao generico)
- Adicionar botao "Abrir WhatsApp" com link direto `wa.me/55{telefone}` ao lado dos botoes de copiar
- Apos gerar mensagem, mostrar botao que copia + abre WhatsApp em sequencia

### 3. StageCoachBar: Botoes conectados ao HOMI

**Arquivo:** `src/components/pipeline/StageCoachBar.tsx`

- Botoes como "Script de ligacao", "Perguntas de qualificacao" e "Enviar vitrine IA" atualmente nao fazem nada (`onClick` undefined)
- Conectar cada botao ao `onOpenHomi` passando um prompt contextual (ex: "Gere um script de ligacao para este lead na etapa sem_contato")
- Quando o botao tiver `onClick` definido (ex: criar tarefa), manter; caso contrario, redirecionar para HOMI com prompt pre-preenchido

### 4. Alerta visual para leads parados em Atendimento

**Arquivo:** `src/components/pipeline/StageCoachBar.tsx`

- Quando `stageTipo === "contato_iniciado"` e `diasSemContato >= 3`, exibir banner de alerta vermelho: "Lead parado ha X dias em Atendimento - etapa mais critica do funil"
- Usar a regra do Sistema Operacional: "Lead parado em Atendimento e o erro mais comum"

### 5. Meta do Dia na visao do corretor (sem aprovacao)

**Arquivo:** `src/pages/CorretorDashboard.tsx`

- O `DailyProgressCard` ja existe e mostra metas. O pedido e garantir que a meta apareca automaticamente, sem exigir aprovacao/setup
- Se `goals === null`, definir metas default automaticamente (30 ligacoes, 5 aproveitados, 3 visitas) ao inves de abrir editor
- Corretor ve a meta do dia imediatamente ao entrar, sem friccao

---

### Resumo de arquivos

| Arquivo | Mudancas |
|---|---|
| `src/components/pipeline/StageCoachBar.tsx` | Anti no-show, follow-up 5 dias badge, alerta atendimento parado, botoes conectados ao HOMI |
| `src/components/pipeline/HomiLeadAssistant.tsx` | Campo "o que cliente disse", botao WhatsApp direto |
| `src/pages/CorretorDashboard.tsx` | Meta auto-default sem friccao |
| `src/components/corretor/DailyProgressCard.tsx` | Auto-save metas default quando goals === null |

