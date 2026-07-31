# Auditoria do Placar do Dia (31/07) + legenda de pontuação na TV

## O que a auditoria encontrou

Sessão ao vivo: 31/07, 07h–23h (BRT). 15 corretores pontuando.

**1. Os pontos batem com o extrato — exceto por uma visita duplicada**

William Ferreira, 1º lugar com 145 pontos. O extrato dele:

```text
5 aproveitados x 5 pts  =  25
4 visitas agendadas x30 = 120
                   total = 145
```

Só que uma dessas 4 visitas é duplicada: o cliente **Marcelo Amazonas** (mesma data 01/08, mesmo lead) foi registrado duas vezes — 14:33 pelo mutirão e 14:40 de novo pelo pipeline (registro manual marcado como no_show). Pela regra "uma visita por cliente por dia", ele pontuou 30 pts a mais.

Resultado correto: **115 pontos, 3 visitas, 5 aproveitados** — e ele continua em 1º lugar com folga (2º tem 50).

Nenhum outro corretor tem visita duplicada hoje. Os demais (Jéssica 50, Thalia 50, Marcos 35, Eliézer 35, Adriana 35, etc.) batem 100% com o extrato.

**2. Os contadores exibidos estão fora de sincronia com o extrato**

A tabela de participantes guarda contadores separados do extrato de pontos, e eles divergiram:

| Corretor | Contador aproveitados | Extrato real | Contador ligações | Extrato real |
|---|---|---|---|---|
| William Ferreira | 7 | 5 | 64 | 66 |

Ou seja: os pontos estão certos, mas os números "ligações / aproveitamentos" mostrados na TV vêm de outra fonte e não explicam a pontuação. É exatamente o que a legenda pedida precisa resolver — a legenda só faz sentido se derivar da mesma fonte dos pontos.

**3. Esteira e captura de visitas do pipeline: funcionando**

Visitas marcadas fora do mutirão estão entrando no placar (Douglas, Billy, Brizola, Rafaela Campos e Rafaela Sandin pontuaram 30 só por visita do pipeline). A trava anti-duplicidade existe hoje, mas tem duas brechas: janela de 5 minutos curta (a duplicidade do Marcelo aconteceu com 7 min) e comparação por nome quando o lead não está vinculado.

## O que será feito

### Fase 1 — Corrigir os dados de hoje
- Remover do extrato a linha de visita duplicada do Marcelo Amazonas (William Ferreira).
- Recalcular pontos e contadores de **todos** os participantes da sessão a partir do extrato (fonte única), zerando as divergências.
- Resultado esperado: William 115 pts / 3 visitas / 5 aproveitados; demais inalterados.

### Fase 2 — Placar passa a derivar tudo do extrato
- A função do placar passa a calcular pontos, ligações, aproveitados e visitas somando o extrato da sessão, em vez de ler contadores denormalizados. Assim os números na TV sempre explicam a pontuação.
- Fortalecer a trava anti-duplicidade: janela de 5 min → mesma data + mesmo cliente/lead, sem limite de tempo, cobrindo também visitas sem lead vinculado (por telefone além do nome).

### Fase 3 — Legenda no Placar TV
- Em cada linha do Ranking dos Corretores, abaixo dos pontos, uma micro-legenda:
  `3 visitas x30 + 1 aprov. x5`
- Nos cards de equipe, mesma lógica resumida.
- Rodapé do placar com a régua de pontuação fixa: `Tentativa 0 pts · Aproveitado 5 pts · Visita agendada 30 pts`.
- Tipografia pequena e discreta (9–11px), no estilo atual do placar, sem quebrar o layout de TV.

### Fase 4 — Validação ao vivo
- Abrir `/placar-tv` no preview e conferir: William em 1º com 115, legenda batendo com os pontos, rodapé legível, e um registro de teste refletindo em tempo real.

## Detalhes técnicos

- Migração 1 (dados): DELETE da linha duplicada em `oferta_ativa_ligacoes` + UPDATE de `oferta_ativa_participantes` recalculando `pontos`, `ligacoes_count`, `aproveitamentos_count`, `visitas_count` por agregação do extrato da sessão.
- Migração 2 (lógica): `rpc_placar_mutirao` passa a montar `parts` a partir de `oferta_ativa_ligacoes` agregado (LEFT JOIN com participantes só para equipe/gerente/status online); ajuste em `trg_visita_conta_mutirao_fn` removendo a janela de 5 minutos e incluindo telefone normalizado na chave de deduplicação.
- Frontend: apenas `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx` (linhas do ranking, cards de equipe e rodapé). Nenhuma outra tela é tocada.
- Regra de pontuação preservada: tentativa 0 · aproveitado 5 · visita 30.
