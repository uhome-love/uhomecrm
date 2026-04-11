

## Diagnóstico: Lead aparece como "expirado" instantaneamente

### Causa Raiz (BUG CRITICO)

No `LeadAcceptanceDialog.tsx`, o estado `remaining` começa em `0`:
```
const [remaining, setRemaining] = useState(0);
```

Quando o dialog abre com um lead válido, dois efeitos rodam simultaneamente:
1. **Countdown effect** — calcula o tempo correto e chama `setRemaining(diff)` (mas o state update é assíncrono/batched)
2. **Auto-close effect** — verifica `remaining === 0 && open && lead` → como `remaining` ainda é 0 do estado inicial, **fecha o dialog imediatamente** com a mensagem "Tempo expirado!"

Isso explica perfeitamente o comportamento: Luiza recebe o push, abre o CRM, o dialog aparece por um frame e some com "Lead será redistribuído" — ou nem aparece visualmente.

### Bugs Secundários

**BUG 2**: O `usePendingLeadAlert` usa `new Date().toISOString()` (relógio do browser) para filtrar `aceite_expira_em`. Se o relógio do celular estiver 1-2 minutos adiantado, leads válidos são filtrados como "já expirados".

**BUG 3**: O polling está em 30s mas o comentário diz 15s. 15s seria mais apropriado para urgência de aceite.

### Plano de Correção

**Arquivo 1: `src/components/pipeline/LeadAcceptanceDialog.tsx`**
- Inicializar `remaining` com `-1` (sentinel value) em vez de `0`
- Alterar o auto-close effect para só fechar quando `remaining === 0 && remaining !== -1` (ou seja, só quando o countdown realmente chegou a zero, não no estado inicial)
- Adicionar um guard: só mostrar o timer quando `remaining > 0`

**Arquivo 2: `src/hooks/usePendingLeadAlert.ts`**
- Substituir `new Date().toISOString()` por uma query que usa `NOW()` do servidor (ou adicionar margem de 60s ao filtro do browser)
- Reduzir polling de 30s para 15s
- Adicionar `checkPending()` imediato quando o tab ganha foco (`visibilitychange`)

### Detalhes Técnicos

```text
Estado atual (bugado):
  Dialog abre → remaining=0 → auto-close dispara → "Expirado!" → dialog fecha

Estado corrigido:
  Dialog abre → remaining=-1 (ignorado pelo auto-close) → countdown seta remaining=245 → countdown normal → remaining=0 → auto-close dispara corretamente
```

Sem necessidade de migrations no banco. Apenas correções em 2 arquivos frontend.
