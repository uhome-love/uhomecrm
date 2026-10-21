# Redesign mobile — o que já foi feito e o que falta

## Já pronto
- Fim do zoom nas caixas de texto principais, respeito ao "risco" do iPhone, barra de baixo (Início, Clientes, +, Tarefas, Mais) e tela "Mais".
- Janelas sobem de baixo em todo o app.
- Telas redesenhadas: Início do corretor, Pipeline (topo e lista), cliente aberto, Agenda (Prioridades), Agenda de visitas, Oferta Ativa (portas e seleção), Imóveis, HOMI, Materiais, LIA.
- Painel do CEO: voltou ao visual do computador, a seu pedido (fora desta análise).

## O que ainda falta (achado na varredura)
Das 90 telas do app, só cerca de 15 têm ajuste próprio para celular. As outras são a tela do computador espremida.

1. **Zoom que ainda acontece** — cerca de 110 caixas de texto e listas "soltas" (fora do padrão) ainda usam letra pequena e dão zoom no iPhone. Ex.: busca de leads, filtros, observações em alguns formulários.
2. **Tarefas** — agrupar em Atrasadas / Hoje / Próximas, concluir com um toque e deslizar para adiar. Hoje é a tela do computador.
3. **Oferta Ativa durante a ligação** — cartão do cliente em tela cheia e botões grandes de resultado (Aproveitar, Não atendeu, Sem interesse) presos embaixo. Inclui o Mutirão Ao Vivo.
4. **Negócios** — quadro de negócios vira lista por fase, igual ao Pipeline.
5. **Painel do gerente e da diretora** — mesma decisão do CEO? (ver pergunta abaixo). Inclui "Meu time" e PDN.
6. **Roleta** — tela do corretor (credenciar, ver status) em cartões grandes; tela de gestão da Roleta com listas no lugar de tabelas.
7. **Relatórios, Ranking, Performance, Central de Relatórios** — cerca de 68 telas têm tabelas largas que geram rolagem lateral. Viram listas de cartões no celular.
8. **Telas menos usadas no celular** (Marketing, Reengajamento, Base Única, Configurações, Academia, RH, Notificações): só ajustes para não quebrar — sem rolagem lateral, botões com tamanho de dedo.
9. **Acabamento** — carregamento com "esqueleto" no lugar das rodinhas, telas vazias bonitas, "puxar para atualizar" nas listas principais, teste final em iPhone pequeno e grande, claro e escuro.

## Ordem sugerida (uma fase por vez, mockup e validação antes de cada uma)
1. Zoom restante (rápido, vale para tudo)
2. Tarefas
3. Oferta Ativa na ligação + Mutirão
4. Negócios
5. Roleta (corretor e gestão)
6. Painéis gerente/diretora
7. Relatórios e tabelas
8. Telas menos usadas
9. Acabamento e teste final

## O que não muda
Computador igual. Regras, Roleta, Bolsão, VGV e dados intocados. Só visual.

## Pergunta antes de começar
Painel do gerente/diretora no celular: redesenhar ou manter igual ao computador, como o do CEO?

## Detalhes técnicos
- Zoom: varredura de `<input>/<select>/<textarea>` avulsos sem `text-base`/`text-[16px]`; aplicar `text-base md:text-sm`. `select.tsx`/`command.tsx` conferir.
- Tabelas: padrão `hidden md:table` + lista `md:hidden` usando o mesmo array, sem duplicar consultas.
- Telas grandes tocadas acima de 300 linhas são divididas. Sem mudanças no banco.
- Cada fase: mockup → plano → build → validação ao vivo em 393px com lead de teste.
