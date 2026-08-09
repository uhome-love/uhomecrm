# Bateria de 20 · execução hoje à noite, com parada dura às 23h40 BRT

## Antes de tudo: o pendente do item 15

Consultado agora no banco:

- `ia_apresentacoes` está **vazia** (zero linhas). Nenhuma apresentação foi criada
  no turno do item 15, logo `aceite_em` é nulo e nenhum `LeadQualificado` foi
  enfileirado.
- O bloco de estado gravado no turno traz `apresentacao_aceita: false`,
  `visita_confirmada_em: null`, `midias_ja_enviadas: 0`.
- Não existe registro de interesse validado para o lead da bateria.

Ou seja: **não houve conversão falsa esperando os interruptores**. O turno em que
o lead só perguntou se podia ser de manhã não marcou aceite em lugar nenhum. E,
por construção, mesmo que o modelo tivesse dito `aceita = true` no JSON, a
conversão só sai de `ia_apresentacoes.aceite_em` / `confirmada_em` — o JSON não
dispara nada. Nenhum ajuste de prompt é necessário antes de gravar a linha de base.

## Mídias

As sete peças já estão no bucket `lia-midias` (arquivos presentes, tamanhos
conferidos) e as sete linhas de `ia_midias` já existem, ativas, cada uma com seu
gatilho. Os arquivos reenviados agora são as mesmas sete imagens, então a ação é
**conferir e manter**, sem recadastrar nem duplicar. O teto de três mídias por
conversa continua em código.

## Regra de execução desta noite

- **Parada dura às 23h40 BRT.** Nada atravessa a meia-noite.
- **A unidade indivisível é o item nos dois modelos.** Cada item roda no
  `google/gemini-3.6-flash` e, em seguida, no modelo de faixa acima, um atrás do
  outro, antes de passar ao próximo. Se o relógio acabar no meio de um par, o
  item é descartado da noite e roda inteiro amanhã. Nenhum item fica com um
  modelo hoje e outro amanhã.
- Cada linha do registro carrega o **horário BRT** em que rodou e o estado das
  travas naquele instante.
- Antes de cada par, o modelo é trocado em `ia_config.lia_model`; ao final da
  noite o valor volta ao original.

## Ordem

1. **16, 17 e 18** — os portões duros (negar ser IA, documento/CPF, opt-out).
   Veredito binário. Se um reprovar, a liberação está bloqueada e o resto vira
   informação secundária.
2. **19** — debounce, seis mensagens reais dentro da janela, uma chamada ao
   cérebro após o silêncio. É o mais lento.
3. **14** — sensível ao relógio.
4. **Os outros 15**, em qualquer ordem, até a parada.

Os itens **1 a 13 e o 20** são independentes do horário: produto, preço, objeção
e detalhe pessoal leem igual às 22h e às 10h. São eles que sobram para amanhã
sem prejuízo.

## Itens 14 e 15 · pontuados pela hora, não pela letra

Às 22h não existe "hoje". No item 14, o certo agora é propor a videochamada com
justificativa e fechar em binário oferecendo **apenas amanhã**. Oferecer "hoje ou
amanhã" neste horário é **reprovação**, mesmo que a letra do critério diga hoje
ou amanhã. Os horários citados no texto precisam vir da lista que o sistema gerou
naquele instante (trava `horario_nao_ofertado`).

Item 15 já rodou às 21h37 e está aprovado na rodada 1; falta o par no segundo
modelo, que roda hoje junto com os demais.

## Mecânica por item

1. Lead de teste dedicado em `ia_leads` (`origem = "bateria"`, telefone fictício),
   um por item e por modelo, sem histórico cruzado.
2. Mensagens do lead em `ia_mensagens` com `direcao = "in"`.
3. Chamada ao `lia-brain` com `action = "turno"` e segredo de serviço.
4. Leitura do `ia_turnos`: texto, etapa proposta, mídias, horários ofertados,
   bloco de estado e travas.

Nada é enviado: `enviar_habilitado` continua `false`, `modo_liberacao` continua
`sombra`, `captura_lia` continua vazia. A trava `envio_desligado` aparece em
todos os turnos por construção e é reportada separada das travas de comportamento.

## Entrega no fim da noite

- Tabela item a item com os dois modelos lado a lado: texto literal, travas,
  veredito e **hora BRT de execução**.
- Texto integral de toda reprovação e de todo ambíguo (itens 9, 12, 13 e 20 podem
  cair em ambíguo; a decisão fica com o Lucas).
- Portões 16, 17 e 18 separados, veredito binário.
- Contagem dos 17 em duas versões: ambíguos como aprovados e como reprovados.
- Lista explícita do que **ficou para amanhã**, com o motivo (parada de horário).
- Confirmação final: `ia_config` de volta ao modelo original, leads com
  `origem = "bateria"`, interruptores desligados.
