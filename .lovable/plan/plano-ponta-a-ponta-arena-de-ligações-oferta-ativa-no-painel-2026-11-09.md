# Plano ponta a ponta: "Arena de Ligações" — Oferta Ativa no painel do corretor (Natal)

## Objetivo
Quem ficou fora da Roleta (menos de 2 visitas realizadas) precisa ver, logo ao entrar no CRM, **um caminho claro e animador para voltar**: ligar para clientes das listas, estagnados e descartados, com tudo pronto na tela, e ver pontos, metas e ranking subirem. Sem atrapalhar o que já existe no painel.

## Retrato de hoje (conferido no sistema e no código)
- **7.848 clientes** prontos para ligar nas listas (31.666 no total), além dos estagnados e descartados do Bolsão.
- Últimos 7 dias: **1.200 tentativas feitas por só 17 corretores**.
- Existem hoje **duas Ofertas Ativas separadas**: a do dia a dia (listas, Bolsão, reservados, listas próprias) e o "Mutirão Ao Vivo" por sessão. Cada uma conta ligações num lugar diferente, então ranking e relatórios não batem entre si.
- **Pontuação inconsistente**: a tela promete tentativa 0 / aproveitado +5 / visita +30, mas a Oferta do dia a dia grava 1 por ligação e 3 por interessado. Só o Mutirão segue o 0/5/30.
- Já existem discador, roteiro por empreendimento, ajuda do HOMI com objeções, metas do dia (padrão 30 ligações / 5 aproveitados / 3 visitas), rankings e o placar da TV (hoje só do Mutirão).
- O cartão da Roleta já calcula "faltam X visitas para liberar".
- A proteção de quem pediu para não ser contatado está ligada no discador principal, Bolsão e reservados; ainda falta confirmar no Mutirão, listas próprias e celular.

Conclusão: a ferramenta existe, mas está espalhada, com dois placares e sem um "próximo passo" óbvio.

## A experiência nova

### 1. Painel do corretor: cartão "Volte pra Roleta"
- Fica junto do cartão da Roleta, sem mexer nos demais (Missão Natal, Foco, Próxima visita, Evolução).
- Fora da Roleta: "Faltam X visitas para voltar" + caminho **Ligar → Marcar visita → Realizar visita** com progresso.
- Clientes esperando por ele agora: **Listas · Estagnados · Descartados**, com o empreendimento de maior volume.
- Botão grande **"Começar a ligar"**, placar do dia e posição no ranking da semana.
- Quem já está na Roleta vê versão compacta ("Meta de ligações de hoje").

### 2. Arena de Ligações (uma tela, um cliente por vez)
- **Topo:** placar do dia (ligações, atendidas, aproveitados, visitas, pontos), barras de meta e sequência de dias ligando.
- **Cartão do cliente:** nome, telefone com **Ligar** e **WhatsApp**, empreendimento de interesse, origem (lista, estagnado, descartado e motivo), último contato.
- **Roteiro na tela** por empreendimento e por origem (descartado e estagnado com aberturas diferentes), objeções comuns e botão do HOMI.
- **Resultado em 1 toque:** Não atendeu · Número errado · Sem interesse · Interessado · **Visita marcada** (agenda no mesmo fluxo).
- **Próximo cliente automático**, na ordem de maior chance. Filtro rápido: Tudo · Listas · Estagnados · Descartados · empreendimento.
- Comemoração ao bater meta, aproveitar ou marcar visita. Celular com o mesmo fluxo e botões grandes.
- A Arena usa os mesmos caminhos de hoje para registrar (listas, Bolsão, reservados), então reserva de cliente, prazo do Bolsão e envio ao Pipeline continuam iguais.

### 3. Ranking semanal de ligações (sem prêmio, sempre visível)
- Dia e semana, com pódio e "quem mais subiu"; destaque para quem voltou à Roleta pela Oferta.
- Conta **as duas Ofertas juntas** (dia a dia + Mutirão), para ser justo.
- Aparece na Arena, resumido no painel do corretor e no Ao Vivo.

### 4. Placar da TV
- Novo bloco **"Ranking de ligações da semana"** no placar da TV da empresa (top 10, ligações, aproveitados, visitas), atualizando sozinho, visível mesmo sem Mutirão aberto. O resto do placar continua igual.

### 5. Gestores e relatórios
- Nas abas atuais (sem redesenho): quem está fora da Roleta e quanto cada um ligou hoje/semana.
- Relatórios, checkpoint, Painel CEO, relatório executivo e 1:1 automático seguem lendo os mesmos lugares; só o volume cresce.

## Regras definidas por você
- **Ranking de ligações = número de ligações** (dia e semana), sem prêmio, sempre visível. Aproveitados e visitas aparecem ao lado só como informação; visita marcada já conta no placar do Mutirão, que não muda.
- **Mínimo do dia: 30 ligações · 3 aproveitados · 1 visita agendada.** Vira o padrão das metas diárias (hoje 30/5/3).
- **Todas as listas liberadas e com clientes disponíveis entram na Arena**, além de estagnados, descartados e reservados.
- A pontuação gravada hoje não é alterada; a legenda que promete 0/5/30 na Oferta do dia a dia será corrigida para não confundir.

## O que NÃO muda
- Regras da Roleta, distribuição, Fila CEO, Bolsão e envio do aproveitado ao Pipeline.
- Saída global e higiene; lead ativo no Pipeline continua fora da Oferta.
- Painel CEO e telas atuais da Oferta continuam funcionando (a Arena vira a porta principal).

## Fases (cada uma validada antes da próxima)
0. **Mockups** desktop e celular: cartão do painel, Arena, ranking e bloco da TV. Sem código até aprovar.
1. Fonte única de placar/ranking juntando as duas Ofertas (por número de ligações) e conferência de que os relatórios não mudam de regra.
2. Cartão "Volte pra Roleta" no painel.
3. Arena: cliente, roteiro, resultado em 1 toque, próximo automático, celular.
4. Placar do dia, metas, sequência e comemorações.
5. Ranking semanal + bloco na TV + visão do gerente.
6. Proteção de contato confirmada em todos os caminhos de ligação.
7. **Validação ponta a ponta no preview** com lead de teste (sempre cancelando), desktop, celular e TV; conferir ranking, relatórios e Pipeline. Entrega só depois disso.

## Para decidir no mockup
- Roteiros: usar os cadastrados ou você revisa por empreendimento.

## Detalhes técnicos
- Status Roleta/visitas faltantes: `useMinhaEvolucao` (mesma conta do RoletaTurnoCard) + `roleta_apto_janela`/`roleta_visitas_realizadas_periodo`.
- Fontes da fila: `fetch_next_lead`/`fetch_next_lead_campaign` + locks (`renew_lead_lock`), `bolsao_contagens`/`bolsao_puxar`/`bolsao_registrar` + edge `bolsao-aproveitar`, `oferta_ativa_reservados`. Registro via `finalizar_tentativa_v2` (listas) e caminhos atuais do Bolsão; nada de escrita direta nova.
- Placar/ranking: novo RPC só de leitura unindo `oferta_ativa_tentativas` e `oferta_ativa_ligacoes`, ordenado por quantidade de ligações (aproveitados/visitas como colunas), escopo por papel no servidor, consumido por Arena, painel, Ao Vivo e PlacarTv. Nenhuma mudança em `finalizar_tentativa_v2` nem em pontos gravados; só ajuste da legenda (ScoringLegend). Metas padrão em `useCorretorDailyStats` passam a 30/3/1. Fila da Arena inclui toda lista com status `liberada` e leads disponíveis. Até 1 migration.
- Salvar em memória: ranking por nº de ligações sem prêmio, mínimo diário 30/3/1, todas as listas liberadas na Arena.
- Revisar e aplicar `contatoPermitido`/`check_send_allowed` em Mutirão (LeadCard), listas próprias e DialingMobileView.
- Arena em pasta própria com componentes <300 linhas; não aumentar `DialingModeWithScript` (1.418 linhas) nem `PlacarTv` (573) — bloco da TV em componente separado. Tokens DS v4, tema Natal, motion tokens e "reduzir movimento".
- Testes: contagem do ranking unificado, metas 30/3/1, listas liberadas na fila e visitas faltantes.
