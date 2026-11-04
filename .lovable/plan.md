# Lia Recupera — reengajamento automático de descartados

## O que os dados mostram (consulta só leitura)
- Descartes por mês: ~1.300 a 1.500 (agosto teve 6.068 por limpeza em massa); 99% têm telefone.
- Motivos dos últimos 90 dias: sem motivo 2.543 · não atende/não responde ~1.460 · sem retorno 453 · sem interesse no momento 564 · sem condição financeira 260 · corretor desligado/inativado ~310 · desistiu 117.
- Mais da metade é "não atende" ou "corretor saiu": a pessoa muitas vezes nem chegou a ser bem atendida. É aí que mais tem venda perdida.
- Já existe uma base da Lia (fila e lotes de reativação, caixa isolada) e um Reengajamento manual. Não vamos criar outro sistema: vamos ligar um modo automático em cima disso.

## Como vai funcionar
```text
Descarte -> espera 24h -> Lia filtra -> 1ª mensagem (modelo aprovado pela Meta)
   -> respondeu? -> Lia conversa e entende momento/perfil -> quente -> Roleta com ficha pronta
   -> não respondeu -> lembretes D+3 e D+10 -> encerra (volta só em campanha)
   -> "não"/sair -> nunca mais recebe
```

### 1. Quem entra (filtro)
- Entram: não atende, sem retorno, sem interesse no momento, corretor desligado, estagnação, sem motivo.
- Esperam 90 dias: sem condição financeira, desistiu.
- Nunca entram: pediu para sair, telefone inválido, já comprou, cliente ativo com outro corretor, quem já disse "não" à Lia, descarte definitivo.
- Limite de envio por dia (começa em 100) e só das 9h às 20h, seg–sáb, para não repetir o bloqueio por spam de 13/07.

### 2. Mensagens (precisam de aprovação da Meta)
Quatro modelos de primeira mensagem, escolhidos pelo motivo e pelo produto:
- **A — Não chegou a conversar:** "Olá {nome}, sou a Lia do Relacionamento da Uhome. Você pediu informações sobre o {empreendimento} e acho que não conseguimos falar. Ainda está procurando imóvel? Posso te mandar as opções da nossa campanha de Natal?" [Sim, quero ver] [Outro perfil] [Não, obrigado]
- **B — Sem interesse no momento:** sua versão do texto, com produto + campanha de Natal.
- **C — Corretor saiu:** "Seu atendimento ficou parado e queremos retomar com um especialista."
- **D — Sem produto conhecido:** versão genérica com perfil (bairro/valor/quartos).
- Lembretes D+3 (uma oferta concreta do Natal com preço real) e D+10 (última, "posso encerrar?").
- Vamos testar duas versões de cada uma e a página mostra qual responde mais.

### 3. Conversa da Lia (qualificação)
A Lia pergunta, em poucas mensagens: ainda busca? pra morar ou investir? região, faixa de valor, quartos, prazo, usa FGTS/financiamento. Responde dúvidas com dados reais dos empreendimentos e da campanha de Natal. Nunca inventa preço.
Resultado: **Quente** (quer visita/ligação) · **Morno** (quer receber opções) · **Frio/Não**.

### 4. Passagem para a Roleta
Só **Quente** volta ao pipeline: entra pela Roleta normal (com Fila CEO para produto exclusivo), relógios zerados e sem parceria antiga, com a ficha da Lia: resumo, perfil de busca, produtos sugeridos e a conversa. O corretor recebe a mensagem "cliente reativado pela Lia".
Morno fica com a Lia recebendo opções em 15 dias. Lia nunca muda etapa nem corretor por conta própria.

### 5. Página da Lia — nova aba "Recupera"
- Liga/desliga geral e limite por dia.
- Funil: descartados elegíveis -> enviados -> responderam -> quentes -> visitas -> vendas.
- Fila de hoje, conversas em andamento, quem foi para a Roleta e com qual corretor.
- Desempenho por modelo de mensagem, por motivo de descarte e por produto.
- Botão para pausar um cliente ou mandar para a Roleta manualmente.

## Fases (uma por vez, cada uma validada com você)
0. **Desenho** da aba Recupera + textos finais das mensagens para você aprovar. Nada muda no CRM.
1. Cadastrar e aprovar os modelos na Meta (número da Lia).
2. Filtro + espera de 24h + fila automática (desligada; só mostra quem entraria).
3. **Validar o cérebro da Lia:** bateria de conversas de teste (preço, FGTS, entrada, "não quero", "outro perfil", fora do assunto). Você revisa e só liberamos com 100% aprovado.
4. Envio com piloto de 100/dia; se der resultado, aumentamos.
5. Conversa de qualificação da Lia.
6. Passagem para a Roleta com ficha, sem o corretor que descartou.
7. Painel de resultados e testes A/B.

## Decisões suas (já incluídas)
- Envio pelo número da Lia.
- Produtos: só os da página Campanha Natal 2026, com os preços de lá.
- Materiais: uso os já enviados; o resto pode vir depois.
- Quem descartou não recebe o cliente de volta.
- Piloto de 100 por dia.
- Botão "Não quero mais contato" em toda mensagem: inativa o cliente e ele nunca mais recebe.

## Ainda falta de você
- Respostas para as dúvidas mais comuns (FGTS, entrada, entrega, condomínio) e o que a Lia não pode prometer.
- Confirmar dias e horários (sugestão: seg–sáb, 9h às 20h).

## Parte técnica
- Reaproveita `lia_reengajamento_elegiveis`, `lia_reengajamento_runs`/fila, `lia-reengajar-dispatch`, `lia-followup`, `lia-brain`, `lia-webhook`; nova cron `lia-recupera-tick` (15 min) arma automaticamente quem completou 24h, com dedup por lead e chave independente `system_flags.lia_recupera_enabled`.
- Lia continua em caixa isolada `ia_*`; a volta ao pipeline usa o caminho de reativação existente (`reactivateLead` + `reset_ciclo_reentrada` + `distribuir_lead_atomico`), nada direto.
- Proteção de entrega: mesmas travas de qualidade Meta do Reengajamento (pausa automática por taxa de falha/opt-out).
- Migrations dentro do limite diário, fora do horário comercial quando possível; testes para o filtro (motivos/esperas) e para a regra "só Quente vai para a Roleta".
