## Diagnóstico (verificado)

A página `/meu-time` hoje tem **duas abas** com propósitos misturados:

**Aba 1 — "Visão de Times"** (dois componentes diferentes, um por perfil):
- **Gerente** → `TeamManagement.tsx` (547 linhas). Além de vincular/desvincular corretores a `team_members` e editar o "tag de equipe", **puxa métricas operacionais**: cards "Ligações (semana)" e "Visitas (semana)" (via `oferta_ativa_tentativas` e `visitas`), e mostra esses números por linha de corretor.
- **CEO / Diretor** → `CeoTeamPanel.tsx` (469 linhas). Cards KPI "Total Colaboradores / Gerentes / Corretores / Admin / Online Hoje" + times comerciais agrupados por gerente com **"ligações hoje", "aproveitados hoje", "visitas semana", "VGV mês"** por corretor e por time.

**Aba 2 — "Todos os Usuários" / "Meu Time"** → `UsuariosTable.tsx` (a Central de Usuários nova). Já cobre 100% da gestão de usuários: busca, filtros por status/perfil, criar, editar (drawer com abas Perfil / Acesso / Equipe / Atividade), inativar, reativar, excluir com transferência de dados, trocar de equipe e trocar de perfil.

**Por que existem as duas visões e por que elas divergem:** são de gerações diferentes. `TeamManagement` e `CeoTeamPanel` são anteriores à Central de Usuários e foram construídos misturando organograma + operacional. A Central de Usuários foi a refatoração recente, mas as visões antigas ficaram convivendo como uma aba paralela — daí a duplicação de métricas e a diferença de UX entre gerente e CEO.

**Nenhum outro lugar importa esses dois componentes** — só a página `MeuTime.tsx` os usa. Deletá-los não quebra outras telas.

## Decisão do plano

Unificar tudo na Central de Usuários (a aba nova). A página `/meu-time` passa a ser **exclusivamente gestão de usuários**, sem KPIs operacionais. Ligações/Visitas/VGV continuam existindo — no seu lugar correto: Relatórios de Performance.

## O que muda

1. **Remover as abas** em `src/pages/MeuTime.tsx`. A página passa a renderizar diretamente `<UsuariosTable />`, mantendo o header (título + descrição) que já muda entre "Central de Usuários" (CEO/Diretor) e "Minha Equipe" (Gerente).
2. **Deletar os arquivos legados** (não há mais nenhum consumidor):
   - `src/components/checkpoint/TeamManagement.tsx`
   - `src/components/ceo/CeoTeamPanel.tsx`
3. **Preservar o que era útil das visões antigas**, garantindo que já existe na Central de Usuários:
   - Ver o gerente/equipe de cada corretor → já é coluna "Equipe" da tabela + aba "Equipe" do drawer.
   - Trocar corretor de equipe → já existe em `TrocarEquipeDialog` acionado pelo drawer.
   - Ativar/inativar/excluir → já existe.
   - Criar novo usuário (com vínculo a gerente) → já existe no `NovoUsuarioWizard`.
4. **Não mover nem duplicar nenhum KPI operacional.** Ligações/Visitas/VGV **saem** desta página. Se o usuário quiser vê-los depois, o caminho é Relatórios de Performance (fora do escopo deste plano).

## Validação

- Confirmar que a página abre limpa como gerente (Bruno) e como CEO, sem cards de Ligações/Visitas/VGV.
- Confirmar que criar, editar, inativar, reativar e trocar de equipe continuam funcionando pelo drawer.
- Confirmar que os arquivos legados foram deletados e o typecheck passa sem imports quebrados.

## Fora de escopo

- Redesenhar Relatórios de Performance ou mover os KPIs operacionais para lá.
- Alterar RLS, RPCs (`list_profiles_admin`) ou o edge function `create-broker-user`.
- Alterar o organograma visual por times coloridos (se voltar a ser desejado, cria-se uma página separada de "Estrutura / Organograma" — não é gestão de usuários).