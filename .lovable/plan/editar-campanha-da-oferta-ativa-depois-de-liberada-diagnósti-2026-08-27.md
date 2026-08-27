# Editar campanha da Oferta Ativa depois de liberada (+ diagnóstico do caso William)

## O que eu verifiquei no banco (fatos, não suposição)

**1. A "Campanha de Investimento - Agosto 2026" está vencida.**
- `liberada_em`: 20/08 12:19 BRT
- `expira_em`: **23/08 23:59 BRT** (já passou — hoje é 27/08)
- `status` continua `liberada`, por isso ela ainda aparece na tela de gestão, mas **não aparece para nenhum corretor**.

Motivo: existem dois filtros por prazo, e os dois cortam essa campanha hoje.
- Regra de segurança do banco: corretor só enxerga lista `liberada` **e** `expira_em > agora`.
- Tela do corretor: mesma regra repetida no filtro da lista.

Ou seja: **não é problema do William em específico — nesse momento nenhum corretor vê essa campanha.** Ela sumiu para todo mundo às 23:59 de 23/08.

**2. O William Ferreira está dentro do escopo.**
O escopo da campanha tem 3 equipes selecionadas, e ele está ativo em uma delas. Se a campanha estivesse dentro do prazo, ele veria.

**3. Mas o escopo NÃO é "todo mundo".**
A campanha foi salva com 3 equipes (30 corretores ativos). Existem **7 corretores ativos sem equipe** no cadastro — esses nunca veriam a campanha, mesmo dentro do prazo. "Todo mundo" de verdade só acontece com escopo vazio (sem equipes e sem corretores).

**4. Hoje não existe nenhuma forma de editar a campanha depois de liberada.** A única ação disponível na lista de campanhas é "Encerrar".

## O que vou construir

### A. Botão "Editar" nas campanhas ativas
Na aba de campanhas (Oferta Ativa e Base Única), cada campanha `liberada` ganha um botão **Editar** ao lado de "Encerrar". Abre um painel com:

- **Quem pode ligar** — mesmo seletor usado na criação: "Todo mundo" (escopo aberto) ou restrito por equipes e/ou corretores avulsos, com os já selecionados marcados. Permite **incluir corretores** um a um, sem depender de equipe.
- **Prazo** — data/hora de expiração, com atalhos "+1 dia / +3 dias / +7 dias" e opção "sem prazo". É isso que **reativa** uma campanha vencida como a de Investimento.
- Resumo em linguagem simples: "42 corretores vão ver esta campanha" ou "Todos os corretores vão ver esta campanha".

Salvar grava `escopo` e `expira_em` na campanha; a lista volta a aparecer para os corretores na hora seguinte ao refresh.

### B. Aviso de campanha vencida
Na tabela de campanhas, campanha `liberada` com prazo já passado ganha etiqueta **"Vencida — ninguém está vendo"** em vermelho, para nunca mais acontecer de uma campanha parecer ativa e estar invisível na operação.

### C. Aviso de "corretor sem equipe"
No seletor de escopo, quando for escolhido "restrito por equipe", mostro um alerta discreto: "X corretores ativos não estão em nenhuma equipe e não verão esta campanha — use 'Todo mundo' ou inclua-os individualmente."

## Detalhes técnicos

- **Frontend**: novo `EditarCampanhaDialog.tsx` em `src/components/leads-base/campanha/`, reaproveitando `PassoEscopo.tsx` e `MultiPicker.tsx`. Ligado em `CampanhasPanel.tsx` (coluna Ação).
- **Mutation**: nova `useEditarCampanha()` em `src/hooks/useBaseLeads.ts` — `update` em `oferta_ativa_listas` nos campos `escopo` e `expira_em`, invalidando `oa-campanhas` e `oa-listas`.
- **Permissão**: a política atual só deixa **admin** alterar `oferta_ativa_listas` (gestor só lê). Como o painel de campanhas já é restrito a admin/diretor, não é preciso mexer em política de banco. Se você quiser que gestor também edite, é uma migration à parte — me diga e eu incluo.
- **Sem migration** neste escopo: só frontend + mutation.
- Nenhuma mudança na regra de quem enxerga a lista (`status = liberada AND expira_em > agora`) — ela continua sendo a fonte da verdade nos dois lados.

## Ação imediata que isso destrava

Depois do build, você abre a Campanha de Investimento → Editar → estende o prazo (ex.: +7 dias) e troca o escopo para "Todo mundo". Ela volta a aparecer para o William e para todos os corretores, inclusive os sem equipe.
