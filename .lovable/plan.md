# HOMI — o copiloto do dia a dia do corretor

## O problema real (o "porquê")

As telas do CRM são **passivas**: o corretor precisa *saber* o que procurar. A Central de Tarefas mostra uma lista, a Agenda mostra horários, os Imóveis mostram um catálogo. Nenhuma delas responde a pergunta que o corretor faz o dia inteiro:

> "O que eu faço **agora** para vender mais?"

O HOMI ganha quando é o contrário: **proativo, consolidado e já com a ação pronta na mão.** Em vez de o corretor abrir 4 telas e cruzar informação na cabeça, ele faz uma pergunta e recebe a próxima ação com o botão de executar ao lado.

| Em vez de… | Por que o HOMI |
|---|---|
| Abrir a Central de Tarefas e ler a lista | HOMI já ordena por prioridade e diz *qual ligar primeiro e o que falar* |
| Buscar imóvel manual (filtros, chips) | HOMI entende "2 dorms no Petrópolis até 600 mil" e **já devolve o link + mensagem pronta pra enviar** |
| Ir na Agenda de Visitas | HOMI faz o **briefing da visita**: quem é o lead, o que já rolou, o imóvel e 3 argumentos |
| Garimpar quem esfriou | HOMI **detecta** leads parados e entrega o reengajamento já escrito |

O HOMI não substitui as telas — ele vira o **ponto de partida** que empurra o corretor pra elas com a decisão já tomada.

---

## O conceito central: "Meu dia"

Hoje o HOMI abre só com uma saudação e espera o corretor pedir algo. As ferramentas existem (`ver_pendencias`, `leads_esfriando`, `preparar_visita`, `contexto_lead`, `buscar_imovel`), mas estão soltas — o corretor precisa saber pedir cada uma.

A mudança-chave: **um comando único que costura tudo numa narrativa do dia.**

Botão de destaque no topo do painel + comando natural ("meu dia", "por onde começo?"):

```text
☀️ Bom dia, Adriana. Seu dia em 3 frentes:

🔴 AGORA (2)
  • Ligar pra Marilá — visita marcada ontem, sem retorno   [💬 Msg pronta] [📞 Registrar]
  • João pediu retorno hoje 14h                            [👤 Abrir]

🏠 VISITAS DE HOJE (1)
  • 16h — Carlos no Reserva Petrópolis                     [📋 Briefing]

❄️ ESFRIANDO (3)  — sem contato há 5+ dias
  • Ana, Pedro, Lucas                                       [💬 Reengajar todos]
```

Cada linha já tem o botão que resolve. É a diferença entre "aqui está sua lista" e "faz isso agora, ó a mensagem".

---

## Escopo do plano

### Parte 1 — Ferramenta `meu_dia` (edge `homi-tools.ts`)
Read-only, escopada por RLS. Agrega numa única resposta:
- **Agora**: tarefas atrasadas/de hoje + leads que pediram retorno (reusa lógica do `ver_pendencias`).
- **Visitas de hoje**: da agenda, cada uma com gancho pro `preparar_visita`.
- **Esfriando**: reusa `leads_esfriando` (parados 5+ dias).
- Retorna estrutura seccionada que a UI renderiza como blocos com ações — sem repetir em texto.

### Parte 2 — Prompt do copiloto (`homi-chat/index.ts`)
- Registrar `meu_dia` e instruir: quando o corretor perguntar "meu dia", "por onde começo", "o que faço agora", "resumo do dia" → chamar `meu_dia` e responder com 1 frase de contexto ("Foco na Marilá e na visita das 16h").
- Manter a regra atual de **não** abrir com briefing automático: o "Meu dia" é sob demanda (botão ou frase), não intrusivo.

### Parte 3 — UI do painel (`HomiPanel.tsx` + `HomiActionCard.tsx`)
- No estado vazio do painel (a saudação atual), trocar a lista genérica de quick-actions por um botão-herói **"☀️ Meu dia"** em destaque, com os atalhos secundários abaixo (Atrasados, Imóvel, WhatsApp).
- Novo cartão `MeuDiaCard` no `HomiActionCard.tsx`: renderiza as 3 seções (Agora / Visitas / Esfriando) com os botões de 1 toque, reaproveitando os cartões já existentes (contexto_lead, preparar_visita, reengajar).
- Barra de acesso rápido: promover "☀️ Meu dia" como primeiro chip.

### Parte 4 — Fechar o loop de cada ação (reforço, sem novas tabelas)
Garantir que toda ação sugerida no "Meu dia" já abra o próximo passo pronto (a maioria já existe, aqui é conferir ponta a ponta):
- Ligar → `contexto_lead` gera a mensagem → botão **Copiar/WhatsApp**.
- Visita → `preparar_visita` gera o briefing.
- Esfriando → `contexto_lead` gera o reengajamento.
- Após registrar resultado (`registrar_resultado`), sugerir a próxima tarefa (já implementado) — validar que aparece.

---

## Arquivos afetados
- `supabase/functions/homi-chat/homi-tools.ts` — nova ferramenta `meu_dia` (agregadora, read-only).
- `supabase/functions/homi-chat/index.ts` — registrar `meu_dia` + regra de prompt.
- `src/components/homi/HomiPanel.tsx` — botão-herói "Meu dia" no estado vazio + chip.
- `src/components/homi/HomiActionCard.tsx` — `MeuDiaCard` com as 3 seções e ações.
- `src/contexts/HomiContext.tsx` — roteamento do resultado `meu_dia` para o novo cartão.

Sem migração de banco. Toda escrita continua exigindo confirmação do corretor.

## Validação ponta a ponta (como corretora Adriana)
1. Abrir o HOMI → clicar **☀️ Meu dia** → ver as 3 seções com ações.
2. "Por onde começo?" (texto livre) → mesma resposta agregada.
3. Clicar **Msg pronta** num item de Agora → mensagem com contexto do lead, botão WhatsApp.
4. Clicar **Briefing** numa visita → resumo + imóvel + argumentos.
5. Clicar **Reengajar** num esfriando → mensagem pronta.
6. Registrar um contato → próxima tarefa sugerida aparece.
