# Campanha Natal Chave de Ouro no CRM

Período da decoração: 03/11 a 26/12/2026 (horário de Brasília). Campanha: 02/11 a 18/12. Nada do que já funciona muda: Pipeline, Roleta, Oferta Ativa, Visitas, Negócios e Financeiro continuam iguais. Fora do período, nada de Natal aparece.

Ordem de trabalho (regra do projeto): para cada passo, desenho para aprovação, depois construção, depois teste na tela. Um passo por vez.

## Passo 1 — Decoração (só visual)
- Faixa fina de luzes no topo (30 px no computador, 26 px no celular), que não cobre nada.
- Gorro no logo da barra lateral e na foto do corretor na Minha Rotina.
- Saudação da Minha Rotina com fundo azul-noite, neve leve, Homi de Noel e o aviso "Faltam X dias para 18/12". Textos atuais mantidos.
- Neve suave só no topo da Minha Rotina, do painel do gerente e do CEO. Nunca no Pipeline, em janelas ou na Oferta Ativa.
- Botão "Efeitos de Natal: ligado/desligado" em Configurações. Com "reduzir movimento" do aparelho, luzes e neve param.

## Passo 2 — "Minha Missão de Natal" (corretor)
- Painel só de leitura na Minha Rotina, logo depois da saudação.
- VGV assinado na campanha com barra dourada e chave de ouro andando; visitas realizadas da semana; ritmo até 18/12 (média de 1 venda a cada 13,4 visitas, ticket de R$ 649 mil).
- 6 números: leads recebidos, visitas agendadas, visitas realizadas, negócios, vendas, VGV assinado. Mesma fonte dos relatórios atuais.
- Barras da equipe (meta R$ 10 mi) e da Missão 100 milhões da Uhome (desde 01/01/2026).
- Janela "Qual é a sua meta de Natal?": abre uma vez sozinha e pelo botão "Minha meta". Mínimo R$ 1 mi; visitas por semana de 1 a 30 (padrão 3).
- Bateu a meta: confete dourado 1 vez por dia e selo "Missão cumprida". De 19/12 a 26/12 mostra o resultado final.
- Guardar as metas: lista nova só para isso. O corretor vê e edita só a dele; o gerente vê a da equipe; a direção vê todas. Nenhuma outra lista muda.

## Passo 3 — "Corrida de Natal da equipe" (gerente)
- Painel só de leitura no topo do painel do gerente: VGV da equipe vs R$ 10 mi, comparação com as outras equipes, cada corretor com meta, progresso e visitas da semana. Quem não definiu meta conta com R$ 1 mi e 3 visitas.
- O gerente vê só a própria equipe.

## Passo 4 — "Placar de Natal" (TV)
- Mesmo placar de hoje com roupa de Natal: neve, Homi de Noel, contagem até 18/12, barra dourada da meta, gorro no 1º lugar, "VISITA MARCADA" com sininho e "VISITA REALIZADA" com o começo de Jingle Bells e "+1 chave para a missão".
- 2 faixas novas no rodapé: "Missão 100 milhões" (VGV do ano e de cada equipe na campanha) e "Prêmio surpresa da semana" (top 3 em visitas realizadas de segunda a domingo, com primeiro nome e inicial).
- Essas faixas usam uma leitura nova que mostra só totais e o top 3, sem telefone nem cliente. A leitura atual do placar não muda.

## Passo 5 — Em 26/12
- Confirmar que tudo sumiu em 27/12 e trazer plano para remover a decoração. As metas dos corretores ficam guardadas.

## Enfeites
- Recebidos: gorro, Homi de Noel, árvore, luzes (2 versões), selo Natal Chave de Ouro (escuro e claro), chave de ouro com laço e urna premiada. Serão usados como estão.
- Faltam presentes, sino, bolas e estrela: onde eles apareceriam, uso emojis (🎁 🔔) ou deixo sem. Os desenhos 01 a 06 não vieram; o desenho de cada passo eu mostro antes de construir.

## Detalhes técnicos
- Tudo de Natal em `src/natal/` com `config.ts` (`NATAL_INICIO`, `NATAL_FIM`, `isNatal()` via helpers BRT de `@/lib/brtTime`, constantes 649000 e 13,4). Provider `<TemaNatal>` em AppLayout adiciona `.tema-natal` no `<html>`; tokens em `src/natal/natal.css` só sob essa classe. Enfeites em `public/natal/`.
- Arquivos existentes tocados com poucas linhas de import/encaixe: `AppLayout`, barra lateral, `CorretorDashboard.tsx`, `GerenteCockpit.tsx`, `CeoDashboard` (só neve no topo), página de Configurações, página do Placar do Dia (troca visual e notas de `tocarSom` só no período).
- Dados: `fetchMetricas`/`rpc_metricas`, `somarMetricas`, `consolidarPorCorretor`, `agruparPorEquipe`; negócios por `negocios` no período; equipe por `team_members`. React Query, staleTime 2 min.
- Banco (2 migrations, fora do horário comercial): tabela `campanha_natal_metas` (user_id, meta_vgv ≥ 1.000.000, meta_visitas_semana 1–30) com RLS e GRANTs (dono / gestor da equipe / admin e diretor via helpers existentes); RPC `rpc_placar_natal()` SECURITY DEFINER no padrão de `rpc_placar_do_dia`, só agregados e top 3 com primeiro nome + inicial.
- Teste: `isNatal()` nas datas-limite, cálculo de ritmo e mínimo de R$ 1 mi.
