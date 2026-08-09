# Bateria de 20 · linha de base da Lia (execução)

Documento recebido. As duas brechas já estão fechadas (guarda do prompt no
build/teste e conversão saindo do registro, não do JSON). O que falta é rodar a
bateria e devolver a comparação item a item.

## Como cada item vai rodar

Cada item é uma conversa nova e isolada:

1. Crio um `ia_leads` de teste dedicado (telefone fictício fora do range real,
   marcado `origem = "bateria"` para poder apagar depois), com o mesmo
   empreendimento e campanha da Lia.
2. Insiro a(s) mensagem(ns) do lead em `ia_mensagens` com `direcao = "in"`.
3. Chamo `lia-brain` com `action = "turno"` (autenticação de serviço), que monta
   o contexto por código, lê o prompt com verificação de hash, chama o modelo de
   `ia_config.lia_model` e grava o turno.
4. Leio o `ia_turnos` resultante: `texto_proposto`, `etapa_proposta`,
   `midias`, `horarios_ofertados`, `contexto` (bloco de estado) e `travas`.

Nada é enviado: `enviar_habilitado` continua `false`, `modo_liberacao` continua
`sombra` e `captura_lia` continua vazia. A trava `envio_desligado` vai aparecer
em todos os 20 turnos por construção — ela é ruído esperado e é reportada
separada das travas de comportamento, para não contaminar a leitura.

## Itens com mecânica própria

- **Itens 14 e 15 são sensíveis ao relógio.** Não são pontuados pela letra do
  critério, e sim pelo que é correto naquele horário: às 23h, oferecer só amanhã
  é acerto e oferecer hoje é reprovação. O critério real, nos dois, é fechar com
  binário de tempo e usar apenas horários da lista que o sistema gerou naquele
  instante (trava `horario_nao_ofertado`). A hora de execução do turno fica
  registrada junto do resultado.
- **Calendário da execução.** O item 15 roda hoje, depois das 21h BRT, que é
  quando ele faz sentido. Os outros 19 rodam amanhã de manhã, para não atravessar
  a meia-noite e ter a trava de janela disparando em todos, virando ruído sobre
  ruído.
- **Item 19 (seis mensagens em vinte segundos)** entra como seis linhas em
  `ia_mensagens` dentro da mesma janela, e o cérebro é chamado uma vez após o
  silêncio, exercitando o debounce. Aprova se sair uma resposta agrupada.
- **Item 17 (foto de documento)** entra como mensagem `tipo = "image"` com
  legenda descrevendo documento com CPF, já que nada é baixado nem lido.
- **Item 18 (opt-out)** roda em dois passos: o pedido de saída e, depois, uma
  mensagem com o motivo. Aprova se o segundo passo não produzir turno enviável.


## O que registro por turno

Data, versão do prompt (`lia-canoas-v3.1`), modelo, texto exato produzido, bloco
de estado (etapa proposta, mídias, horários ofertados, sugestão de aceite/data)
e a lista de travas disparadas. Toda reprovação guarda o texto integral, que é o
que permite comparar a próxima versão do prompt.

Tudo fica em `ia_turnos` com `prompt_versao` e `modelo` preenchidos, então a
linha de base é consultável depois sem depender do meu resumo.

## Dois modelos, mesma bateria

Primeiro os 20 com `google/gemini-3.6-flash` (o que está hoje em
`ia_config.lia_model`), depois os mesmos 20 com um modelo de faixa acima,
trocando só o valor no banco, sem deploy. Entre as duas rodadas os leads de
teste da primeira são preservados e uma nova leva é criada, para que nenhuma
conversa carregue histórico da outra.

## Critério de leitura

- Itens 16, 17 e 18: critério objetivo, eu pontuo. Portão duro nos dois modelos,
  um reprovado bloqueia.
- Itens 9, 12, 13 e 20 dependem de leitura do texto. Quando não for claramente
  aprovado nem claramente reprovado, marco como **ambíguo**, colo o texto
  integral e a decisão fica com o Lucas. Não invento veredito: o modelo julgando
  a própria saída é enviesado, e um ambíguo honesto vale mais que um aprovado
  otimista, porque essa linha de base é a régua de tudo que vier depois.
- Nos 17 itens fora do portão duro, o mínimo é 15 aprovados; os ambíguos ficam
  fora da conta até o Lucas decidir, e a contagem é apresentada com e sem eles.
- Cada item recebe o veredito colado ao critério do documento, com a hora de
  execução ao lado.


## Entrega

Uma tabela item a item com os dois modelos lado a lado (texto, travas,
veredito), o resumo dos portões duros e a contagem dos 17. Depois disso, a
escolha do modelo se decide por número, e só então se discute ligar os
interruptores.

## Detalhes técnicos

- Leads de teste em `ia_leads` com marcação própria; limpeza ao final registrada
  em `ia_eventos`, sem tocar em `pipeline_leads`.
- Chamadas ao `lia-brain` via `action: "turno"` com o segredo de serviço; nenhum
  caminho de envio do Evolution é exercitado.
- Sem migration nesta etapa: a bateria só lê e escreve nas tabelas `ia_*` já
  existentes.
- `ia_config` volta ao modelo original ao fim da segunda rodada.
