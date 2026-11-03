# Plano de qualidade — CRM no computador

Percorri as principais páginas no computador (tela de 1440px), entrando como CEO: Dashboard, Pipeline, Visitas, Roleta, Financeiro, Relatórios/Performance, Oferta Ativa, Imóveis, Configurações, Reengajamento, Base de leads, Academia e Materiais. Este plano segue o mesmo jeito do mobile: **desenho primeiro, depois uma fase por vez, cada fase validada por você**. Nenhuma regra de negócio muda (contagens, Roleta, vendas, financeiro); a mudança é só no visual e na usabilidade.

## O que encontrei (geral, vale para todas as páginas)

1. **Espaço perdido no topo**: o aviso "Ative as notificações push" aparece em todas as páginas e ocupa cerca de 110px, mesmo depois de aparecer várias vezes. Somando a barra de abas e o cabeçalho, o conteúdo começa só na metade da tela.
2. **Barra de abas duplicada**: a faixa "Dashboard CEO · Pipeline · Tarefas · Roleta…" repete o menu lateral, vai crescendo sem limite e tem itens sem ícone (Tarefas).
3. **Cabeçalhos diferentes em cada página**: tamanho do título, ícone, subtítulo e posição dos botões mudam de página para página (Performance tem título fino, Financeiro tem título grosso, Pipeline tem título pequeno).
4. **Filtros de período sem padrão**: "Hoje/Semana/Mês" aparecem em pelo menos 4 estilos diferentes (botões soltos, pílulas, abas, chips azuis).
5. **Botões sem padrão**: o botão HOMI aparece em lugares diferentes; "Atualizar", "Incluir" e "Excel" têm pesos visuais diferentes; o azul principal é usado também em ações secundárias.
6. **Menu lateral**: o nome "UhomeSales" no topo está acinzentado e apagado; os grupos são longos (Ferramentas tem 9 itens); falta indicar qual grupo está aberto; não dá para recolher só em ícones com dica ao passar o mouse.
7. **Cartões de números (KPIs)**: cada página tem um modelo diferente (borda colorida à esquerda, ícone dentro, número colorido ou preto). Valores zerados aparecem com o mesmo destaque que valores reais.
8. **Telas vazias**: "Nenhuma parcela pendente", "Nenhum credenciamento pendente" e outras mostram só texto cinza, sem orientar o que fazer.
9. **Busca global (⌘K)** pequena e pouco visível; não fica claro o que ela encontra.

## O que encontrei por página

- **Dashboard CEO**: saudação, Missão de Natal e filtros empilhados antes dos números; "Leads por Corretor" lista corretores com 0 no topo; o botão Fila CEO fica isolado à direita.
- **Pipeline**: a busca aparece cortada ("Buscar lead, c"); são 7 controles na mesma linha (corretores, gestores, filtros, prioridade, fila, HOMI, mais); os cartões de equipe têm alturas diferentes; "Meta do mês não configurada" aparece em itálico solto.
- **Visitas**: está boa; ajustar o padrão dos números e dar mais destaque ao horário e ao status na lista.
- **Roleta**: tem duas camadas de abas (Operação/Leads… e Roleta ao vivo/Pendentes…) que confundem; os 6 números do topo são todos iguais em peso.
- **Financeiro**: **bug** — as datas "De/Até" aparecem no formato americano (11/01/2026 = 01/11); o campo "Mês" começa como "Escolher" mesmo com um período preenchido; o saldo total pendente fica escondido no rodapé.
- **Relatórios/Performance**: 4 controles de visão diferentes no topo (Visão geral, Equipe, Meus resultados e mais uma lista "Funil & Resultado"); setas vermelhas em todos os números quando a semana mal começou (comparação injusta).
- **Vendas e Usuários**: na varredura automática não abriram a tempo (ficou na página anterior). Preciso conferir de novo na Fase 0.
- **Demais páginas** (Oferta Ativa, Imóveis, Configurações, Reengajamento, Base de leads, Academia, Materiais): entram no mesmo padrão de cabeçalho, filtros, números e telas vazias.

## Fases (uma por vez, validando cada)

**Fase 0 — Desenho e conferência**
- Conferir Vendas, Usuários, Tarefas, Agenda e Bolsão com calma, e também como gerente e como corretor.
- Desenho (mockup) do novo padrão de casca do CRM: topo, menu lateral, cabeçalho de página, filtros, números, botões e tela vazia. Mais o desenho do Dashboard CEO e do Pipeline já no padrão novo.
- Você aprova antes de qualquer mudança.

**Fase 1 — Casca do CRM (vale para tudo)**
- O aviso de push vira um item discreto no sino de notificações e para de ocupar o topo; aparece no máximo 1 vez por semana.
- Barra de abas: limite de 6 abas, todas com ícone, opção de fechar todas e de desligar a barra.
- Menu lateral: logo nítido, grupos mais curtos (Ferramentas dividido), grupo ativo destacado, modo recolhido só com ícones e dica ao passar o mouse.
- Busca global maior no topo, mostrando o que ela encontra (clientes, imóveis, páginas).

**Fase 2 — Peças padrão**
- Um cabeçalho único de página: ícone, título, subtítulo e ações à direita (uma principal em azul, as outras discretas).
- Um seletor de período único: Hoje, Ontem, Semana, Mês, 30 dias e Personalizado, com datas no formato brasileiro.
- Um cartão de número único: rótulo, valor e comparação; valor zerado fica mais apagado.
- Uma tela vazia única: ícone, frase e um botão de ação.
- HOMI sempre no mesmo lugar (canto do cabeçalho).

**Fase 3 — Páginas principais**
- Dashboard CEO, Pipeline, Roleta, Visitas e Tarefas no novo padrão, mais as correções listadas acima (busca cortada, filtros agrupados em "Filtros", corretores com 0 vão para o fim, abas da Roleta simplificadas).

**Fase 4 — Gestão e números**
- Financeiro (corrigir as datas, o Mês acompanhar o período, saldo pendente em destaque), Vendas, Intermediação e Relatórios/Performance (comparação justa com o mesmo período até hoje).

**Fase 5 — Demais páginas**
- Oferta Ativa, Imóveis, Reengajamento, Base de leads, Academia, Materiais, Configurações, Usuários, Presença, Foco e Recrutamento.

**Fase 6 — Varredura final**
- Passar em todas as páginas com contas de CEO, gerente e corretor, em telas de 1280px e 1920px; conferir que nada quebrou no celular; lista final do que mudou.

## Detalhes técnicos
- Peças novas em `src/components/ui/` (PageHeader, PeriodFilter, KpiCard, EmptyState) usando as cores do tema; páginas migradas aos poucos, sem mudar consultas nem hooks.
- O aviso de push passa a ser controlado por frequência em armazenamento local; a barra de abas ganha limite e preferência por usuário.
- Bug das datas do Financeiro: padronizar a exibição e a entrada de datas em BRT com formato dd/mm/aaaa.
- O celular não muda (o redesign mobile aprovado continua intacto); a decoração de Natal continua funcionando.
- Arquivos acima de 500 linhas que forem tocados serão divididos, seguindo a regra do projeto.
