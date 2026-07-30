# Fase 5 — Academia Uhome estilo Netflix/Hotmart

Transformar `/academia` em um hub único com hero "Continue de onde parou", carrosséis por categoria, capas de curso (pôster 2:3) enviadas pelo gestor e abas internas. Sem mudança de regra de negócio: XP, progresso, quiz e certificados continuam exatamente como hoje.

## 1. Capas dos módulos (upload pelo gestor)

- Criar bucket público `academia-capas` (Lovable Cloud Storage) com políticas: leitura pública; escrita/atualização/remoção apenas para gestor/admin (via `has_role`).
- Reutilizar o campo já existente `academia_trilhas.thumbnail_url` — nenhuma coluna nova.
- Em `AcademiaGerenciarPage.tsx`, no formulário de trilha: área de upload (arrastar ou clicar), preview no formato pôster 2:3, recomendação 640x960px, JPG/PNG até 2MB, botão "Remover capa".
- Fallback automático quando não há capa: gradiente + ícone por categoria (comportamento atual mantido).

## 2. Nova home `/academia`

Estrutura da aba "Trilhas":
- **Hero** "Continue de onde parou": usa a lógica de `continueData` já existente em `AcademiaPage.tsx`; fundo com a capa da trilha (ou gradiente), barra de progresso, botões "Continuar aula" e "Ver trilha completa". Some quando não há trilha iniciada.
- **Faixa de estatísticas** (4 cards): aulas concluídas, XP, trilhas concluídas, certificados — substitui o card "Seu progresso" atual.
- **Carrosséis horizontais** por categoria, na ordem: Continue assistindo · Empreendimentos · Objeções e Scripts · Técnicas de Vendas · Processos Uhome · Treinamento do Sistema. Categorias sem trilha publicada não aparecem (exceto os placeholders "🔒 Em breve" já existentes).
- **Cards pôster 2:3** com selos: `NOVO` (criada nos últimos 7 dias), `% em andamento`, `✅ Concluída`, `🔒 Em breve`.

## 3. Hub com abas

- `/academia` passa a ter abas: **Trilhas · Meu progresso · Certificados · Gerenciar** (a última só para gestor/admin/diretor), controladas por `?tab=`.
- `Meu progresso` e `Certificados` são montados a partir dos dados que `useAcademia` já expõe (progresso, XP, nível, `certificados`).
- `/academia/gerenciar` vira redirect para `/academia?tab=gerenciar`; `AcademiaGerenciarPage` é reaproveitada como componente da aba (com prop `showHeader={false}`, mesmo padrão da Fase 4).
- Rotas de trilha e aula (`/academia/trilha/:id`, `/academia/aula/:id`) permanecem intactas.

## 4. Arquivos

Novos, em `src/components/academia/`:
- `AcademiaHero.tsx`, `AcademiaStatsStrip.tsx`, `TrilhaRail.tsx`, `TrilhaPosterCard.tsx`, `TrilhaCapaUpload.tsx`, `MeuProgressoTab.tsx`, `CertificadosTab.tsx`.

Alterados:
- `src/pages/AcademiaPage.tsx` (vira shell de abas, hoje com 294 linhas → fica enxuto)
- `src/pages/AcademiaGerenciarPage.tsx` (prop `showHeader`, bloco de upload de capa)
- `src/config/pageRegistry.ts`, `src/lib/routePatterns.ts`, `src/App.tsx` (redirect da rota gerenciar)
- `src/hooks/useAcademia.ts` (apenas mutation de upload/remoção de capa; nenhuma mudança nas queries existentes)

## 5. Validação

Após o build: typecheck limpo, e validação ao vivo no preview — abas do hub, redirect de `/academia/gerenciar`, upload de capa em uma trilha de teste, hero apontando para a aula correta e carrosséis renderizando. Nenhum dado de aluno é alterado no teste.
