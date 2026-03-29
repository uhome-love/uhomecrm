

## Mudanças Cirúrgicas em PipelineLeadDetail.tsx

### Resumo

Remover badges de temperatura e score do header, substituir por chip de status "Atualizado/Desatualizado" baseado nas variáveis já existentes.

### Mudanças

**1. Remover TEMPERATURA_MAP (linhas 63-67)**
Deletar o objeto `const TEMPERATURA_MAP = {...}`.

**2. Remover badge de temperatura (linhas 273-276)**
Deletar o `<span>` que renderiza `TempIcon` e `temperatureInfo.label`.

**3. Remover badge de score (linhas 278-294)**
Deletar o bloco IIFE que renderiza emoji + score + tooltip.

**4. Adicionar chip de status no lugar (após o stage pill, onde estava o badge de temperatura)**

Lógica computada inline no JSX:
- `isAtualizado = nextTask !== null`
- `diasSemContato` calculado via `differenceInHoursSafe` (já importado)
- Array `motivosDesat` montado condicionalmente
- Chip verde "✓ Atualizado" ou chip vermelho/amarelo "⚠ Desatualizado" com motivos abaixo

Todas as variáveis necessárias (`nextTask`, `noContactAlert`, `lead.ultima_acao_at`, `differenceInHoursSafe`, `CheckCircle2`, `AlertTriangle`) já estão disponíveis no escopo.

### Arquivo único alterado
`src/components/pipeline/PipelineLeadDetail.tsx`

### O que NÃO muda
- Hooks, queries, useEffects
- Alerta inline `noContactAlert` nas linhas 458-481
- Banco de dados (sem migrations)
- Nenhum outro arquivo

