# Uhome Sales no celular — redesign completo com cara de app

## Como está hoje
- No celular, o menu é o menu lateral do computador escondido numa gaveta (botão ☰). Não tem barra de atalhos embaixo.
- Os campos de texto usam letra de 14px. No iPhone, letra menor que 16px faz a tela dar zoom sozinha quando você toca para digitar. Esse é o motivo do zoom.
- Só algumas telas (Pipeline, lead, Imóveis, HOMI, Materiais) têm ajuste próprio para celular. As outras são a tela do computador espremida.
- As janelas (modais) abrem no meio da tela, como no computador. Nos apps bons, elas sobem de baixo.

## Direção visual (estilo Apple / Instagram)
- Fundo claro (off-white) e modo escuro na cor Deep Slate atual. Destaque em Indigo #4969FF. Fonte do sistema do iPhone (SF), para parecer nativo.
- Cabeçalho grande no topo ("Pipeline", "Tarefas"), que encolhe e fica translúcido quando você rola a tela.
- Barra de atalhos embaixo, translúcida com efeito de vidro, respeitando a área do "risco" do iPhone.
- Cartões com cantos arredondados, sombras suaves e bastante espaço. Botões com pelo menos 44px de altura, para o dedo.
- Toque com resposta visual (o botão "afunda" de leve), transições suaves entre telas e "puxar para atualizar".

## Barra de baixo (5 atalhos, muda por cargo)

```text
Corretor:  [Início] [Clientes] [ + ] [Tarefas] [Mais]
Gestor:    [Painel] [Pipeline] [ + ] [Time]    [Mais]
```
- **"+" central:** abre um menu que sobe de baixo, com Novo lead, Marcar visita, Nova tarefa e Oferta Ativa.
- **Tarefas:** mostra um número com as pendentes do dia.
- **Mais:** abre uma tela organizada em grupos, no estilo dos Ajustes do iPhone, com todas as outras páginas, o perfil, as notificações e o botão Sair. Substitui o menu ☰.

## Fases (uma de cada vez, com validação no celular antes da próxima)

**Fase 0 — Mockup.** Desenho em alta qualidade das telas: Início do corretor, Pipeline, Lead aberto, Tarefas, Oferta Ativa (portas + ligação), o menu do "+" e a tela "Mais". Você aprova antes de qualquer mudança.

**Fase 1 — Base (vale para o app inteiro).**
- Fim do zoom: todo campo de digitação passa a ter 16px no celular (texto, caixas de texto, listas de seleção e busca). O zoom manual com os dedos continua funcionando.
- Respeitar o "risco" e a barra inferior do iPhone, e usar a altura real da tela para nada ficar escondido atrás do teclado.
- Tirar o "flash" azul ao tocar e o efeito de "elástico" que arrasta a página inteira.
- Ícone e cor da barra de status no app instalado na tela inicial.

**Fase 2 — Navegação.** Barra de baixo, cabeçalho grande e tela "Mais". No celular, as abas de cima do computador e o menu lateral somem. O computador não muda.

**Fase 3 — Janelas que sobem de baixo.** Modais e formulários (marcar visita, registrar atividade, repassar, descartar) viram painéis que sobem de baixo e fecham arrastando para baixo. Botão principal fixo embaixo.

**Fase 4 — Telas principais redesenhadas.**
- **Início / Minha Rotina:** próxima visita no topo, atalhos grandes e evolução do mês em cartões que deslizam para o lado.
- **Pipeline:** uma etapa por vez, com etapas como "pílulas" que deslizam no topo. Lista de cartões. Deslizar o cartão para o lado mostra ações rápidas (WhatsApp, ligar, tarefa).
- **Lead aberto:** tela cheia com foto/iniciais, botões redondos (Ligar, WhatsApp, Visita, Tarefa) estilo contato do iPhone, e a história em linha do tempo.
- **Tarefas:** agrupadas por Atrasadas / Hoje / Próximas, concluir com um toque.
- **Oferta Ativa:** portas em cartões grandes, cartão da ligação em tela cheia com botões grandes de resultado.
- **Agenda de visitas:** faixa de dias deslizando no topo, visitas em lista.

**Fase 5 — Telas de gestão.** Painéis do CEO/diretora/gerente, Performance da Roleta, Roleta e relatórios: KPIs em cartões que deslizam e tabelas virando listas de cartões.

**Fase 6 — Acabamento e validação.** Carregamento com "esqueleto" no lugar de rodinhas, estados vazios bonitos, teste ponta a ponta em iPhone pequeno (SE) e grande (Pro Max), claro e escuro, com lead de teste. Nada de dados reais alterado.

## O que não muda
- A versão de computador continua igual.
- Regras, distribuição, Roleta, Bolsão, VGV e dados: nenhuma mudança. É só visual e navegação.

## Detalhes técnicos
- Zoom: `text-base md:text-sm` em `ui/input`, `ui/textarea`, `ui/select`, `ui/command` e inputs avulsos encontrados por varredura. Sem `maximum-scale=1` (preserva acessibilidade).
- `env(safe-area-inset-*)`, `100dvh`, `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`, `apple-mobile-web-app-status-bar-style` e `theme-color` no index.html/manifest.
- Novo `src/components/layout/mobile/`: `MobileBottomNav`, `MobileLargeHeader`, `MobileMaisSheet`, `MobileQuickCreate`. Itens por cargo derivados da mesma fonte de rotas/roles do Sidebar, para não duplicar permissões. `Sidebar.tsx` (679 linhas) deixa de renderizar Sheet no mobile.
- Modais: wrapper `ResponsiveDialog` (Dialog no desktop, Drawer/vaul no mobile), migrado tela a tela.
- Tokens novos (vidro, sombras, raio) em `index.css`/`tailwind.config.ts`; nada de cor fixa nos componentes.
- Arquivos acima de 300 linhas tocados são divididos, conforme as regras do projeto. Sem mudanças no banco.
