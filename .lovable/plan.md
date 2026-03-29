

## Reorganizar Notificações + Sidebar + Deep-linking Claro

### 1. Novas categorias de filtro em `src/pages/Notificacoes.tsx`

Substituir as 6 tabs atuais por 4 categorias de negócio:

| Tab | Label | Tipos/Categorias incluídos |
|---|---|---|
| todas | Todas | * |
| roleta | 🎰 Roleta | `lead_roleta`, `lead`, `leads`, `lead_timeout`, `lead_urgente`, `lead_ultimo_alerta`, `fila_ceo` + categorias `lead_novo`, `lead_aceito`, `lead_atribuido` |
| pipeline | 📋 Pipeline | `lead_sem_contato`, `lead_parado`, `lead_alto_valor`, `automacao`, `sequencias`, `radar_intencao` + categorias `lead_retorno`, `lead_sem_atendimento`, `problema_atendimento`, `volume_leads` |
| visitas | 📅 Visitas | `visitas`, `visita_agendada`, `visita_confirmada`, `visita_noshow` + categoria `visita_*` |
| performance | 🏆 Performance | `meta_atingida`, `xp_conquista`, `relatorio_semanal`, `corretor_inativo`, `zero_ligacoes`, `corretor_ajuda`, `alertas`, `mensagem_gerente`, `gerente_sem_visita` |

Filtro checa **ambos** `n.tipo` e `n.categoria` para capturar todas as variações.

### 2. Notificações mais claras e com redirecionamento em `src/components/notifications/NotificationList.tsx`

- **Nome do lead em destaque**: Já existe a extração via `getContextDetails`, mas quando `dados` não tem `lead_nome`, extrair também de `titulo` (padrão "Novo lead: João Silva")
- **Situação/etapa visível**: Mostrar `d.etapa` ou `d.stage_nome` como badge ao lado do tipo (ex: "Qualificação", "Sem Contato")
- **Label de ação**: Adicionar texto "Ver lead →" ou "Ver visita →" na linha de tempo quando a notificação é clicável, para deixar claro que dá pra clicar
- **Mensagem sempre visível**: Mostrar `n.mensagem` em 2 linhas (line-clamp-2) sempre, não esconder quando tem contexto
- O deep-linking já funciona (`getNotificationRoute`) — apenas tornar visualmente óbvio com o texto de ação

### 3. Item "Notificações" no sidebar do corretor em `src/components/AppSidebar.tsx`

Adicionar no grupo "Gestão Comercial" (após Pipeline de Leads):
```
{ title: "Notificações", url: "/notificacoes", icon: Bell }
```
Com badge de `unreadCount` usando o hook `useNotifications`.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Notificacoes.tsx` | 4 novas categorias de filtro, filtro por tipo+categoria |
| `src/components/notifications/NotificationList.tsx` | Etapa como badge, label "Ver lead →", mensagem sempre visível, extração de nome melhorada |
| `src/components/AppSidebar.tsx` | Item Notificações com badge no menu corretor |

