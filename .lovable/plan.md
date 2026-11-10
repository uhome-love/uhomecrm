# Melhoria visual do CRM — harmonia sem perder a identidade

Objetivo: deixar o CRM bonito, organizado e coerente em todas as telas, mantendo a marca atual (azul do logo, Homi, off-white/azul escuro, cantos 12px). Base: o arquivo de revisão visual que você anexou e a auditoria de novembro.

## Regras que valem em todas as fases
- Nada muda no funcionamento, nos números ou nas regras — só aparência e organização.
- Cada fase: desenho (computador + celular 390px) → sua aprovação → construção → conferência ao vivo no computador e no celular.
- Painel CEO no computador mantém as seções antigas (decisão já registrada); só acabamento que você aprovar.
- Painéis de gestão no celular seguem a regra já aprovada.

## Fases (uma por vez)

**Fase 1 — Menu e topo (todas as páginas)**
Barra lateral, abas superiores e cabeçalho com o mesmo espaçamento, ícones e destaque da página atual; modo escuro conferido.

**Fase 2 — Peças comuns**
Um só padrão para cartões, títulos de página, filtros de período, tabelas, estados de "carregando", "vazio" e "erro", e selos coloridos. Isso faz todas as telas ficarem parecidas entre si.

**Fase 3 — Telas do corretor**
Painel inicial, Pipeline (seguindo o desenho premium já aprovado), Tarefas, Agenda e ficha do cliente.

**Fase 4 — Telas de gestão**
Painel do gerente, diretora, relatórios e Performance — acabamento e organização; Painel CEO só no que for aprovado.

**Fase 5 — Celular**
Menu de baixo, botão "+", e as telas principais revisadas uma a uma.

**Fase 6 — Conferência final**
Passada geral no computador e no celular, claro e escuro, lista do que ficou e do que falta.

## Primeiro passo após aprovar
Levantamento das telas atuais (capturas) e os desenhos da Fase 1 para você escolher — nenhuma mudança no CRM antes da sua aprovação dos desenhos.

## Detalhes técnicos
- Usar só tokens do design system (src/index.css, shell-*, DS v4); trocar cores fixas pelos tokens nas telas tocadas.
- Componentes compartilhados para cabeçalho de página, estados vazio/erro/carregando e cartões, em vez de estilos por página.
- Animações com os tokens de movimento existentes e respeito a "reduzir movimento".
- Arquivos tocados acima de 500 linhas são divididos durante a fase.
