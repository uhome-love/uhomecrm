# Oferta Ativa (visão CEO) alinhada ao modelo de campanhas temporárias

## O que a página mostra hoje x o que combinamos

A página `/oferta-ativa` ainda é a da era das "listas eternas". Verificado agora no banco e no código:

- No banco só existem **67 listas**: 66 **arquivadas** (as antigas) e **1 encerrada** (a campanha de teste da base). Ou seja: **nenhuma campanha ativa**.
- A aba **"Bases ativas"** lê uma visão que filtra `status = 'ativa'` — um status que **nenhuma lista usa** (as campanhas nascem como `liberada`). Resultado: a aba fica sempre vazia, mesmo com campanha rodando.
- A aba **Configurações** ainda oferece **"Importar"** (subir CSV e criar lista fixa) e **"Campanhas"** (gerenciador antigo de listas, que lista inclusive as 66 arquivadas, porque a consulta não filtra status).
- As campanhas de verdade (janela de liberação, expiração, filtro salvo, retorno dos leads à base) só existem hoje em `/base-leads` → aba Campanhas.
- Resultado prático para o CEO: duas páginas contando histórias diferentes, e a Oferta Ativa mostrando um mundo que não existe mais.

## O que fazer

### 1. Oferta Ativa passa a ser a tela da operação, não do acervo

Nova estrutura de abas em `/oferta-ativa` (CEO/admin/gestor):

- **Campanhas ativas** (nova aba padrão): os cards das campanhas dentro da janela — nome, produto, período (liberada em → expira em), liberados / na fila / tentativas / aproveitados / conversão %, dias restantes, e ações Pausar e Encerrar agora. Botão **"Nova campanha"** que abre o mesmo diálogo de criação a partir da base (o filtro vive na base única).
- **Ao vivo**: o painel Live atual (quem está ligando agora, tentativas do dia).
- **Ranking**: como está hoje.
- **Encerradas**: histórico das campanhas com o resumo final (o que foi trabalhado, o que voltou para a base).
- **Configurações** (admin): Radar/observabilidade e Templates.

### 2. Sai da página

- **Importar CSV** — a entrada de leads passa a ser única, pela Base Única (`/base-leads` → Importar). Remover a sub-aba.
- **Gerenciador de listas antigo** — substituído pela aba Campanhas ativas. As 66 listas arquivadas somem da operação (histórico continua no banco).
- **"Bases ativas"** (grid de listas fixas com "Base da semana") — o conceito de base eterna não existe mais.

### 3. Consertos de dados que a mudança exige

- A visão de potencial das listas passa a considerar **campanhas dentro da janela** (`status = 'liberada'` e `expira_em` no futuro), não `status = 'ativa'`.
- As consultas de listas do CRM (seleção do corretor, painel live, higienização) passam a **excluir arquivadas/encerradas** explicitamente, para não voltar a mostrar as 66 antigas.
- A tela do corretor (`/corretor/call`) continua igual, mas só enxerga campanhas na janela — quando a janela fecha, a campanha some sozinha da lista dele.

### 4. Coerência entre as duas páginas

- `/base-leads` = **acervo e criação** (filtro, higienização, revisão de produtos, importação, criação de campanha).
- `/oferta-ativa` = **operação e resultado** (campanha rodando, ao vivo, ranking, encerramento).
- Link cruzado nas duas: "Ver base" ↔ "Ver campanhas".

## Detalhes técnicos

- Frontend: reescrever `src/pages/OfertaAtiva.tsx` (abas), reaproveitar `CampanhasPanel.tsx` e `CriarCampanhaDialog.tsx` de `src/components/leads-base/`, manter `PerformanceLivePanel` e `RankingOfertaAtiva`; remover do roteamento de abas `ImportListPanel`, `CampaignManager` e `BasesAtivasGrid` (arquivos ficam no repo até a validação).
- Banco (1 migration, só DDL de view): `v_oa_lista_potencial` passa a filtrar `l.status = 'liberada' AND (l.expira_em IS NULL OR l.expira_em > now())`.
- `useOAListas` ganha filtro `.in("status", ["liberada","pausada","pendente"])` e passa a trazer `liberada_em`, `expira_em`, `filtro`, `origem_base`.
- Sem mudança em `oferta_ativa_leads`, `tentativas`, pontuação do mutirão ou cooldown.

## Ordem

1. Mockup da nova `/oferta-ativa` para aprovação.
2. Fix da view + hooks (dados corretos com a estrutura atual).
3. Nova estrutura de abas e remoção do legado.
4. Validação ao vivo: criar campanha pela base, ver aparecer na Oferta Ativa, trabalhar como corretor, encerrar e conferir o retorno dos leads.
