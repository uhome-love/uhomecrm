# Fase 5 — Demais páginas no padrão novo

Só visual e usabilidade. Nenhuma conta, regra de Roleta, Oferta Ativa, Bolsão, disparo, opt-out ou permissão muda. Uma página por vez, conferindo números antes e depois, como CEO, em telas de 1280 e 1920. Celular não muda.

## O padrão aplicado em cada página
- Cabeçalho único: ícone, título, subtítulo, **um** botão principal azul e os demais discretos.
- Filtro de período padrão onde já existe período (sem mudar a régua de datas da página).
- Cartões de números iguais (zerados apagados) e tabelas com o mesmo visual.
- Telas vazias com desenho, frase e o que fazer.
- Datas sempre em dia/mês/ano.

## Páginas, na ordem
1. **Oferta Ativa** (gestão e ranking): cabeçalho, cartões Ligações/Aproveitados/Visitas/Taxa, ranking com medalhas nos 3 primeiros. A tela de ligação do corretor não muda.
2. **Imóveis**: busca grande no topo, filtros em linha, cartões de imóvel com altura igual e botão "Selecionar" padronizado; a vitrine com vários imóveis continua igual.
3. **Reengajamento**: cabeçalho, cartões Respostas/Sim/Não/Opt-out, lista de campanhas com etiqueta de situação. Disparo continua 100% manual.
4. **Base de leads**: cabeçalho, busca e filtros agrupados, tabela no padrão.
5. **Academia** e **Materiais**: cabeçalho e cartões no padrão; capas e vídeos intactos.
6. **Configurações**: menu de seções à esquerda e conteúdo em cartões.
7. **Usuários, Presença, Foco Corretores, Recrutamento/Candidatos**: cabeçalho, tabelas e telas vazias no padrão.

## Como valido
- Antes de cada página guardo os números exibidos; depois da troca confiro que ficaram iguais.
- Abro cada página com a sua conta, sem clicar em ações que gravem dados.
- Te mostro o resultado ao fim, com o que não pude conferir.

## Detalhes técnicos
- Reaproveitar `PageHeader`, `PeriodSelector`/`periodoGrupoClasse`, `KpiCard`, `EmptyState`, `CampoDataBR`.
- Sem trocar hooks, consultas, RPCs ou edge functions; páginas >500 linhas só recebem troca de apresentação, sem refatoração de lógica.
- Nenhuma migration.
