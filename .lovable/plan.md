

## Restauração Completa da Home do Corretor

### Resumo

Reescrever `CorretorDashboard.tsx` com o layout completo e criar `OportunidadesLista.tsx` extraindo apenas a lista de oportunidades (sem saudação/status duplicados).

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/pages/CorretorDashboard.tsx` | **Reescrever** — layout completo com todas as seções |
| `src/components/corretor/OportunidadesLista.tsx` | **Criar** — extrai só a lista de oportunidades do `OportunidadesDoDia.tsx` |

### Layout final (ordem exata)

1. **Banner gradiente** — `linear-gradient(135deg, #4F46E5, #7C3AED, #2563EB)`, avatar, nome, frase motivacional, data/hora
2. **Linha de status compacta** — inline: ponto verde "Na Empresa" + switch, bullet, ícone Target "Na Roleta" + switch (sem cards gigantes)
3. **StatusElegibilidadeRoleta** — componente existente, inalterado
4. **4 KPI cards** — grid 2x2 mobile / 4 cols desktop: Total Leads, Ligações Hoje, WhatsApps, Taxa Aprov.
5. **2 botões de ação** — "CALL / Oferta Ativa" (verde) + "Pipeline" (primary), grid 2 cols
6. **OportunidadesLista** — novo componente que usa `useHomeCorretor` internamente para chamar `get_oportunidades_do_dia` e renderizar a lista agrupada por temperatura
7. **Visitas do Dia** + **Minha Agenda**
8. **Missões de Hoje**
9. **Mini Funil + Evolução** (side by side)
10. **Radar de Leads**
11. **Daily Goals**
12. **Performance Cards** (5 cols)
13. **Ranking**
14. **Gamificação** (Level + Conquistas)
15. **Quick Access** (3 botões)

### OportunidadesLista.tsx

Componente novo que encapsula **apenas** a lógica de fetch e renderização da lista de oportunidades:
- Usa internamente a RPC `get_oportunidades_do_dia` (mesma chamada, sem alteração)
- Agrupa por temperatura: urgentes, quentes, restantes
- Inclui o `CardOportunidade` e o empty state
- **NÃO** inclui saudação, status online, cards de toggle (esses ficam no dashboard)

### Guardrails preservados

- `useHomeCorretor` interno do `OportunidadesDoDia.tsx` — **não alterado**
- `useElegibilidadeRoleta` — **não alterado**, usado como single source of truth
- RPC `get_oportunidades_do_dia` — chamada idêntica
- **Nenhuma migration SQL**
- **Dark mode e cores** — inalterados
- `CorretorHome.tsx` — **não alterado** (referência apenas)
- `OportunidadesDoDia.tsx` — **não alterado** (o novo componente é separado)

### Lógica de status no dashboard

A lógica de toggle online/roleta é extraída do `OportunidadesDoDia` e replicada inline no dashboard como um hook local `useCorretorStatus()`:
- Upsert envia `"na_empresa"` (não `"online"`)
- Bloqueio da roleta usa `podeFazerRoleta` do `useElegibilidadeRoleta`
- Toast de erro em caso de falha no upsert

