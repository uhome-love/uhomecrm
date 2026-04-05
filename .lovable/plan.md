

# Plano: Consolidação Completa das Regras da Roleta de Leads

## Diagnóstico do Estado Atual vs. Regras Desejadas

| Regra | Estado Atual | Precisa Ajustar |
|-------|-------------|-----------------|
| Horários de credenciamento (07:30-09:30, 12:00-13:30, 18:30-20:00) | Parcialmente correto (09:30 e 20:30 no frontend, RPC usa 13h/19h) | Sim |
| Encerramento do turno manhã às 12h | Não existe (manhã distribui até 13h) | Sim |
| Domingos/feriados: dia todo até 23:30 | Funciona (usa tabela feriados) | OK, ajustar horário final |
| Regra domingo: 2 visitas na semana (seg-sáb) | Não existe. Hoje só exige leads atualizados | Sim — nova regra |
| Saída automática ao ficar offline | Existe via trigger | OK |
| Fila CEO quando ninguém na roleta | Funciona | OK |
| Segmento geral (site, imovelweb, Casa Tua) | Parcial — só "Casa Tua" tem `ignorar_segmento=true` | Sim — adicionar origem como critério |
| Leads SEM empreendimento = geral | Funciona (v_segmento_id fica NULL → vai para todos) | OK |
| Distribuição igualitária por turno (reset por turno) | Conta leads desde início da janela | OK, mas ajustar horários |
| Corretor de tarde não "recupera" leads da manhã | Já funciona (conta por janela) | OK |
| Lead rejeitado gira para outros, se ninguém aceita → fila CEO | Funciona | OK |
| 10 minutos para aceitar | Funciona | OK |
| Push notification | Funciona (send-push) | OK |
| Re-credenciamento obrigatório entre turnos | Funciona (credenciamento por janela/dia) | OK |
| Max 10 leads desatualizados para participar | Funciona | OK |
| Dashboard CEO completo com métricas | Parcial — falta visão consolidada | Sim |
| Aba de Configurações na página da roleta | Não existe | Sim — nova aba |

---

## Etapas de Implementação

### 1. Corrigir horários de janelas e credenciamento

**Arquivo**: `src/hooks/useRoleta.ts`

Ajustar as constantes de horário:
- Credenciamento manhã: **07:30 → 09:30** (sem mudança)
- Manhã encerra distribuição às **12:00** (atualmente 13:00 na RPC)
- Credenciamento tarde: **12:00 → 13:30** (sem mudança)
- Tarde ativa: **13:30 → 18:30**
- Credenciamento noturna: **18:30 → 20:00** (atualmente 20:30)
- Noturna ativa: **20:00 → 23:30**
- Domingo/feriado: **08:00 → 23:30**

**Arquivo**: RPC `distribuir_lead_atomico` (migração SQL)

Ajustar os ranges de janela na RPC:
- Manhã: hora < 12 (era < 13)
- Tarde: hora >= 12 AND hora < 18:30
- Noturna: hora >= 18:30

Ajustar `v_janela_start`:
- Manhã: 07:30
- Tarde: 12:00  
- Noturna: 18:30

### 2. Regra de domingo: exigir 2 visitas realizadas na semana (seg-sáb)

**Migração SQL**: Atualizar `get_elegibilidade_roleta` para incluir contagem de visitas da semana.

**Frontend**: `src/pages/RoletaLeads.tsx` — na view do corretor, quando domingo, verificar se tem >= 2 visitas realizadas seg-sáb antes de permitir credenciamento.

**RPC**: Adicionar campo `visitas_semana` no retorno de `get_elegibilidade_roleta`.

### 3. Segmento geral por origem

**Migração SQL**: Atualizar `distribuir_lead_atomico` para tratar leads com origem 'site', 'site_uhome', 'jetimob', 'imovelweb' como segmento geral (ignorar segmento), independente do empreendimento.

**Configuração**: Adicionar coluna `origens_gerais` na tabela de configuração ou criar tabela `roleta_config` para guardar origens que são tratadas como "geral".

### 4. Feriados dinâmicos (substituir lista hardcoded)

**Frontend**: `src/hooks/useRoleta.ts` — substituir `FERIADOS_LIBERADOS` (hardcoded) por consulta à tabela `public.feriados` que já existe no banco.

### 5. Aba de Configurações na página da Roleta (CEO)

**Novo componente**: `src/components/roleta/RoletaConfigTab.tsx`

Funcionalidades:
- **Segmentos**: CRUD dos segmentos da roleta (`roleta_segmentos`)
- **Empreendimentos por segmento**: Gestão de `roleta_campanhas` (qual empreendimento pertence a qual segmento)
- **Origens gerais**: Configurar quais origens de lead ignoram segmento (distribuem para todos)
- **Parâmetros**: limite de leads desatualizados (hoje fixo em 10), limite de descartes (hoje fixo em 50), tempo de aceite (hoje fixo em 10min)

### 6. Dashboard CEO consolidado na página da Roleta

**Melhorar aba "Gestão"** em `src/pages/RoletaLeads.tsx`:

Adicionar cards de métricas:
- Total de leads distribuídos hoje (por turno)
- Leads na fila CEO (pendente_distribuicao)
- Leads aguardando aceite (com countdown)
- Leads não aceitos / timeout hoje
- Leads por corretor (tabela com segmento, turno, aceitos, rejeitados)
- Taxa de aceite por corretor
- Tempo médio de aceite

Reorganizar abas do CEO:
1. **Gestão** — fila ativa, credenciamentos pendentes, aprovar/recusar
2. **Métricas** — dashboard com todos os KPIs acima
3. **Histórico** — roletagens e leads perdidos (já existe)
4. **Leads Gerados** — já existe
5. **Configurações** — nova aba de config

### 7. Migração SQL consolidada

Uma única migração com:
- Atualização de `distribuir_lead_atomico` (horários + origem geral)
- Atualização de `get_elegibilidade_roleta` (visitas da semana para domingo)
- Tabela `roleta_config` para parâmetros configuráveis
- Coluna ou tabela para origens gerais

---

## Detalhes Técnicos

```text
Fluxo completo da roleta:

Lead entra (webhook) → distribute-lead Edge Function
  → distribuir_lead_atomico RPC (atômico com advisory lock)
    → Verifica janela atual (07:30-12:00 manhã, 12:00-18:30 tarde, 18:30+ noturna)
    → Verifica empreendimento → resolve segmento via roleta_campanhas
    → Se origem é "geral" (site/imovelweb) OU sem empreendimento → ignora segmento
    → Busca corretor na roleta_fila (ativo, aprovado, mesmo segmento/janela)
    → Ordena por menos leads recebidos no turno (igualitário)
    → Atribui lead + cria notificação + push + WhatsApp
    → Timer de 10 min para aceite
  → Se ninguém disponível → status = pendente_distribuicao (fila CEO)

Rejeição/Timeout:
  → Lead gira para próximo corretor (excluindo quem rejeitou)
  → Se ninguém aceita → volta para fila CEO

Domingo/Feriado:
  → Janela única "dia_todo"
  → Exige 2 visitas realizadas seg-sáb + sistema atualizado
  → Credenciamento das 08:00 às 23:30
```

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useRoleta.ts` | Ajustar horários, carregar feriados do banco |
| `src/pages/RoletaLeads.tsx` | Regra domingo, aba métricas, aba config |
| `src/components/roleta/RoletaConfigTab.tsx` | **Novo** — configuração de segmentos/origens |
| `src/components/roleta/RoletaMetricasTab.tsx` | **Novo** — dashboard de métricas CEO |
| Migração SQL | RPC atualizada + tabela config |

