# Plano de marca Uhome Sales (design system v4)

Estudei o pacote inteiro: manual da marca, cores claro/escuro, tipografia, 36 componentes com exemplo, regras do Homi e correções tela a tela (`telas.md`). O logo já entrou hoje; este plano leva o **resto do sistema** para o CRM, em fases pequenas, cada uma com desenho → aprovação → construção → conferência no preview.

## Como o pacote separa o trabalho
- **Só aparência (A-Safe):** muda cor, forma, espaço, ícone. Pode subir direto após aprovar o desenho.
- **Muda rótulo/filtro/status (A-Dependent):** cada item vai para você aprovar separado.
- **Muda conta/regra (B):** fica fora deste plano; vira lista para decidir depois (ex.: comparação de visitas com período do mesmo tamanho, alerta que olha a carteira, CRM "agora" vs "semana fechada").

## Fase 1 — Base de cores, fontes e casca (todas as telas)
- Trocar as cores do CRM pelas do pacote: azul #5271FF, botões #3D57E6, ciano só no Homi, verde/âmbar/vermelho só para status, cinzas no lugar de preto. Temas claro e escuro.
- Montserrat 800 em títulos e números de destaque; Inter no resto; números alinhados.
- Menu lateral: item ativo em azul claro com texto azul (sem fundo azul sólido); no tema escuro o menu, a barra de cima e as abas passam a ficar escuros de verdade.
- Barra de cima: busca, botão do Homi, sino e perfil; sino mostra "9+" em vez de "50".
- Botão "Perguntar ao Homi" azul com avatar e fala do Homi em caixa ciano clara.

## Fase 2 — Peças padrão
Montar no CRM as peças do pacote reaproveitando as que já temos (PageHeader, KpiCard, EmptyState, PeriodSelector): StatCard com variação verde/vermelha, Panel, Segmented, FilterChips, BarList, FunnelBars, StageFunnel, DataTable, StatusPill, Meter, HealthDots, HomiInsight, AlertList, MetricList. Uma página de vitrine interna (só admin) para conferir tudo claro/escuro.

## Fase 3 — Dashboard CEO (primeira tela no padrão)
Seguindo `telas.md`, só a parte de aparência:
- Banner azul vira saudação em texto com linha de contexto; sai o "Hoje ▾" duplicado do banner (fica um seletor de período só).
- Cartões sem borda colorida lateral; listas por empreendimento/origem/corretor em uma cor, com "Ver todos".
- Funis em uma cor (Ganho verde, Descarte vermelho); conversões com vírgula ("15,8%").
- Tabelas de equipe/top corretores com linha de total; "Fila CEO" como botão com contador.
- Aba Performance da Roleta: medidor de CRM com meta 80%, bolinhas de saúde com legenda.
- Celular segue o painel já aprovado, só com as cores novas.

## Fase 4 — Demais telas, uma por vez
Agenda, Tarefas, Pipeline, Visitas, Roleta, Relatórios, Financeiro, Oferta Ativa, Lia, Configurações — mesma receita, página por página, conferindo números antes/depois.

## Pontos para você decidir
1. **Emojis:** o pacote proíbe emoji na interface (🆕 📵 🔥 🏠 🤝 📄 🏆 nas etapas do Pipeline, 👋 na saudação). Hoje as etapas usam emoji por regra sua. Trocar por ícones de traço?
2. **Natal:** o pacote diz gorro de 1º/12 a 6/1; você pediu de agora até 31/12. Mantenho o seu.
3. **Rótulos (A-Dependent)** como "Leads Gerados (Mkt)" → "Leads gerados", "Reaproveitados (OA)" → "Reaproveitados": aprovo junto na Fase 3?
4. **Cockpit do CEO** (placar do mês com meta R$ 4,5 mi, "Precisa de você agora"): é uma tela nova proposta no pacote — fica para depois das fases acima?

## O que não muda
Nenhum dado, conta, regra, permissão ou rota. Itens "B" só com aprovação própria.

## Detalhes técnicos
- Mapear `tokens.css` (v4) nas variáveis HSL de `src/index.css` (`--primary`, `--background`, `--card`, `--border`, `shell-*`) mantendo nomes atuais para não quebrar telas; tema escuro em `.dark` (pacote usa `[data-theme="dark"]`).
- Não importar `bundle.js` (React global); recriar as peças em `src/components/ds/` com Tailwind + tokens, seguindo `index.d.ts` para as props.
- Remover variáveis `--ceo-*` e hex fixos de sidebar/topbar/cards da Roleta.
- Assets do Homi 3D (`homi-3d.png`, `homi-noel.png`) via lovable-assets só se usados em estado vazio/celebração.
