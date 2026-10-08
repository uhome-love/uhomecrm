# Campanha Meta Skyglass (Cyrela) — cadastrar e preparar CRM + roleta

## O que encontrei (verificado)
- **Skyglass não existe no CRM.** O único parecido é "Skyline Menino Deus" (inativo), que é outro produto e não será alterado.
- Os conjuntos do anúncio miram **Investidor** (SC/PR/SP e POA/RS), então o grupo sugerido é **S2 - Investimento**.

## O que vai ser feito
1. **Cadastrar o Skyglass** como empreendimento ativo, no grupo S2 - Investimento. Ele passa a aparecer no Foco Corretores (aba Empreendimentos e Alocação).
2. **Nomes alternativos** ("Skyglass", "Sky Glass", "Skyglass Cyrela") para o lead ser reconhecido pelo nome da campanha/formulário.
3. **Regra da roleta do Skyglass**, ligada no S2. Sem corretores alocados, os leads vão para a Fila do CEO — você (ou os gerentes) alocam os corretores no Foco Corretores.
4. **Formulário da Meta:** assim que você criar o formulário do anúncio, busco o código na Meta e cadastro no CRM, igual ao Open Bosque (lead entra como Skyglass, com as respostas e o anúncio clicado no histórico).
5. Conversões para a Meta seguem como nos outros produtos. Não mexo em outros produtos nem na distribuição.

## Validação ponta a ponta
- Conferir no Foco Corretores (preview) que o Skyglass aparece ativo e permite alocar corretor.
- Conferir o formulário ligado ao CRM e testar com lead de teste da Meta: entra como Skyglass, vai para corretor alocado (ou Fila do CEO), mostra anúncio e respostas. Apago o teste depois.

## Preciso de você
- Confirmar grupo S2 - Investimento.
- Nome do formulário do anúncio na Meta (quando estiver criado) e quais corretores atendem.

## Detalhes técnicos
- run_sql: insert em `empreendimentos_canonicos` (nome 'Skyglass', ativo=true, segmento_id `409aeddf-…`), aliases em `empreendimento_aliases`, linha em `roleta_campanhas` (ativo=true, segmento S2). Sem migration.
- Formulário: Graph API (`leadgen_forms`) → `META_FORM_ID_MAP` em `receive-meta-lead/index.ts` e `src/lib/metaFormIdMap.ts` (só uma linha no mapa) + deploy de `receive-meta-lead`.
