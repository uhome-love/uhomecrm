# "Sim, quero participar" (convitesabado_casatuacanoas) — por que só 1 na Fila do CEO

## O que os dados mostram (até 18:15)

5 pessoas clicaram "Sim, quero participar":

| Cliente | Corretor atual | Foi para onde | Registro na linha do tempo | Aviso ao corretor |
|---|---|---|---|---|
| Thainá Fernandes | nenhum | Fila do CEO | sim | n/a |
| Izaqui Alexandre | Cássio Ferreira | ficou com Cássio | não | aviso errado (nome "Lead", foi para a gestão dizendo "Fila do CEO", não para o Cássio) |
| Ateliê Caseirinho | Géssica Santos | ficou com Géssica | não | não |
| Wualisson | Luiza Clós | ficou com Luiza | não | não |
| Gabriela Herzog | Jéssica França | ficou com Jéssica | não | não |

Ter só 1 na Fila do CEO está certo: pela regra de Canoas, quem já tem corretor continua com ele. O problema está nos outros 4: o corretor não recebeu o aviso (pop-up, push e sininho), e a mensagem do disparo com o "Sim" não entrou no histórico do lead.

Nos disparos de Open Bosque de hoje (André, Charles), essa mesma parte funcionou. A falha aparece só neste modelo, quando o lead já tem corretor.

## O que será feito

1. Descobrir por que o "Sim" deste modelo não é reconhecido quando o lead já tem corretor. Primeiro vou ler os registros do webhook dessas 4 respostas. Suspeitas: o texto do botão "Sim, quero participar" não é reconhecido nesse caminho, ou o envio (feito pela Base única) não é ligado ao lead que está no pipeline.
2. Corrigir esse caminho para que o corretor atual receba pop-up, push e sininho com o nome certo do cliente, e para que a linha do tempo mostre a mensagem do disparo e a resposta. Corretor, etapa, roleta e Fila do CEO não mudam.
3. Corrigir os 4 que já responderam: gravar no histórico deles a mensagem e o "Sim", e avisar os corretores Cássio, Géssica, Luiza e Jéssica. Vou apagar o aviso errado do Izaqui que foi para a gestão.
4. Validar: conferir nos dados os 4 casos corrigidos e o próximo "Sim" que chegar.

## Detalhes técnicos

- `whatsapp-webhook`: rota pipeline_ativo_keep para `audience_source='base_unica'` com dono no pipeline (lookup por phone_last8 → `pipeline_leads`); conferir o match positivo para "quero participar" e o nome usado no `lead_reengajado`.
- Backfill: 4 inserts em `pipeline_atividades` (texto do template via Graph API) + `notifications` tipo `lead_reengajado` para o corretor dono + push; delete da notificação "Lead" de 20:34 UTC.
- Sem migration.
