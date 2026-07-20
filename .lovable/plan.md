## Entendimento validado (v2)

**Regime de Presença por dia/turno:**

| Dia / Turno | Como conta presença | Falta? |
|---|---|---|
| **Seg-Sex Manhã** | Presencial — gerente marca Presente/Faltou | ✅ Sim |
| **Seg-Sex Tarde** | Presencial — gerente marca Presente/Faltou | ✅ Sim |
| **Seg-Sex Noturna** | Automático via credenciamento aprovado (remoto, benefício) | ❌ Não participa ≠ falta |
| **Sábado** | Automático via credenciamento aprovado. Quem credenciou = Presente. Quem NÃO credenciou = Falta | ✅ Sim |
| **Domingo** | Benefício remoto. Só participa quem tem elegibilidade: **≥4 presenças na semana + ≥2 visitas realizadas na semana**. Sem falta. | ❌ Não participa ≠ falta |

**Princípios:**
- **Presencial (Seg-Sex M/T + Sábado)** → tem falta.
- **Remoto/Benefício (Noturna + Domingo)** → sem falta; ausência = não-participação neutra.
- **Sábado credenciado = presencial na prática** (visitas/plantões), por isso conta falta.

---

## Ajustes de código

### 1. `getRegimeDoDia()` — nova matriz
```
Seg-Sex: manha (presencial), tarde (presencial), noturna (auto/benefício)
Sábado: sabado (auto via credenciamento, com falta)
Domingo: domingo (benefício, sem falta, elegibilidade calculada)
```

### 2. `PresencaRoletaPanel.tsx`
- **Noturna (Seg-Sex):** lista só credenciados aprovados como "Presente (auto)". Botão Saiu disponível. Sem Presente/Faltou manual. Sem alerta.
- **Sábado:** lista TODOS os corretores ativos. Credenciados aprovados = "Presente (auto)". Não credenciados = "Faltou (auto)". Gerente pode ajustar manualmente (override). Botão Saiu disponível.
- **Domingo:** lista credenciados aprovados como "Presente (auto)". Ao lado de cada nome, badge de elegibilidade (verde "Elegível" / vermelho "Inelegível — X/4 presenças, Y/2 visitas"). Sem Presente/Faltou manual.

### 3. Alerta persistente do gerente
Só dispara em turnos **presenciais com marcação manual**: Seg-Sex Manhã, Seg-Sex Tarde. Sábado é auto (não gera alerta). Noturna/Domingo nunca.

### 4. Registro automático (backend)
- `registrar_presenca_auto_credenciamento()` passa a rodar para: Noturna (Seg-Sex), Sábado (Presente para credenciados + Falta para não-credenciados no fim do dia — ou ao aprovar credenciamento), Domingo (Presente para credenciados elegíveis).
- Sábado: no momento em que o CEO aprova credenciamento de sábado → grava Presente. Ao fim do dia (23:59 BRT), corretores ativos sem credenciamento aprovado no sábado → registro Falta automático.
- Domingo: gate de elegibilidade no ato do credenciamento (já validado antes de aprovar? se não, adicionar validação server-side em `roleta_credenciamentos` ao aprovar credencial de domingo).

### 5. Elegibilidade Roleta Domingo (função SQL)
```sql
elegivel_roleta_domingo(corretor_id, data_domingo) →
  presencas_semana (Seg-Sáb anterior, status='presente') >= 4
  AND visitas_realizadas_semana >= 2
```
Usada tanto na exibição do badge quanto no gate de aprovação.

### 6. Contadores semanais
- "Presenças da semana" = soma de status='presente' em qualquer turno **com regime de falta** (Seg-Sex M/T + Sábado). Noturna e Domingo não entram no contador.

### 7. Backfill
- Remover registros `status='faltou'` em turno Noturna e Domingo dos últimos 30 dias (não existem por definição).
- Reportar contagem.

### 8. UI — copy dos cards
- Noturna: "Turno remoto — presença automática por credenciamento. Sem falta."
- Sábado: "Presença via credenciamento aprovado. Não credenciado = falta."
- Domingo: "Benefício remoto. Elegível: ≥4 presenças + ≥2 visitas na semana."

---

## Ordem de execução
1. Migration: função `elegivel_roleta_domingo`, ajuste em `registrar_presenca_auto_credenciamento` para Sábado/Domingo, cron/trigger para Falta automática no Sábado.
2. Backfill limpando Faltas indevidas em Noturna/Domingo.
3. Frontend: `getRegimeDoDia` + painéis Noturna/Sábado/Domingo + alerta filtrado + badge de elegibilidade.
4. Validação ao vivo com você antes de fechar.

Confirma pra eu implementar?