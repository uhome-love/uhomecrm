# Lead reengajado precisa trocar para o produto do disparo respondido

## O que encontrei (dados reais de hoje)

- **Jorge Jockymann** respondeu "Sim, quero conhecer" ao disparo **Open Arvoredo** (`openarvoredo_novidade`) às 18:21.
  A linha do tempo dele mostra a mensagem do Open Arvoredo certinha, mas o cartão na Fila CEO
  continua como **"Casa Tua Porto Alegre - CAPI - v5"** — produto antigo dele.
- **João Herminio** clicou no botão do disparo antigo do **Open Bosque** (de 02/10). O texto da
  resposta ("Sim, manda as informações") é o botão do Open Bosque, então o rótulo "Open Bosque" dele está correto.

## Por que o Jorge não atualizou

A rotina do banco que reativa o lead ao responder SIM tem uma lista própria de produtos
por nome de disparo. Quando cadastramos o Open Arvoredo hoje, ele entrou na lista do aviso
ao corretor, mas **não entrou nessa lista do banco**. Sem reconhecer o produto, ela mantém o antigo.

## O que vai ser feito

1. Incluir **Open Arvoredo** na rotina de reativação (antes de Open Bosque/Casa Tua), para que
   toda resposta SIM a esse disparo troque o lead para Open Arvoredo, com a nota
   "NOVO INTERESSE ... — antes: Casa Tua Porto Alegre".
2. Corrigir agora o **Jorge Jockymann** para Open Arvoredo (produto e campanha juntos, senão o antigo volta).
3. Conferir se outros leads já responderam ao disparo de Open Arvoredo hoje e corrigir também.
4. Nada muda na distribuição: continuam na Fila CEO para você repassar.

## Validação

- Reabrir a Fila CEO e confirmar o Jorge com o selo "Open Arvoredo".
- Simular uma resposta com um lead de teste (sem disparar nada), conferir o selo e apagar o teste.

## Detalhes técnicos

- Migration (DDL de função): `reativar_base_lead_para_fila_ceo` ganha o ramo
  `ILIKE '%openarvoredo%' OR '%open_arvoredo%' OR '%open arvoredo%' → 'Open Arvoredo'` como primeiro teste.
  Verificar também `reativar_lead_para_fila_ceo` (caminho de descartados) e aplicar o mesmo ramo se tiver mapa próprio.
- Dados (run_sql): `update pipeline_leads set campanha='Open Arvoredo', empreendimento='Open Arvoredo'`
  para o lead `d7433a7f…` e demais respondentes de `openarvoredo_novidade` com produto diferente;
  o gatilho recalcula `empreendimento_canonico_id`.
- Sem mudança de tela nem de webhook.
