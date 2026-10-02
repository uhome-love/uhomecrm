# Casa Tua Canoas: conferência dos "Sim" e ajuste do aviso que foi para a gestão por engano

## O que os dados mostram (convitesabado_casatuacanoas, até 19:40)
São 8 "Sim" no total, 3 a mais que na conferência anterior.

| Cliente | Corretor | Aviso ao corretor | Mensagem na linha do tempo |
|---|---|---|---|
| Izaqui, Ateliê, Wualisson, Gabriela | Cássio, Géssica, Luiza, Jéssica | sim | sim |
| Fabiane Ribeiro (novo) | William Brizola | sim | sim |
| Thainá Fernandes | Roni (recebeu pela roleta) | sim, pela roleta | sim |
| Nicole Maia (novo) | Roni (recebeu pela roleta) | sim, pela roleta | sim |

- Fabiane já era do William. O William recebeu o aviso certo ("respondeu SIM ao disparo"), e a mensagem entrou no histórico dela. A correção de hoje funcionou.
- Thainá e Nicole não tinham corretor. As duas foram para a Fila do CEO, e a roleta passou as duas para o Roni.
- Os "Não" ficam só registrados, sem aviso, como combinado.

## 2 problemas ainda abertos
1. **Aviso errado para a gestão no caso da Fabiane.** Além do aviso certo ao William, os 5 gestores receberam "Lead reengajado na Fila do CEO: Fabiane", mas ela não foi para a Fila do CEO.
2. **Aviso repetido no caso da Thainá.** Cada gestor recebeu 2 avisos iguais sobre ela.

## O que vou corrigir
1. Quando o lead continua com o próprio corretor, a gestão não recebe o aviso de "Fila do CEO". Só o corretor é avisado.
2. Cada pessoa recebe no máximo 1 aviso por lead e por resposta.
3. Vou apagar os avisos errados da Fabiane e os repetidos da Thainá que estão com a gestão.
4. Nada muda em corretor, etapa, roleta ou Fila do CEO.

## Validação
- Vou conferir o próximo "Sim" de um lead que já tem corretor. Só o corretor deve receber aviso, e uma vez só.

## Detalhes técnicos
- `whatsapp-webhook`: o aviso à diretoria só sai quando a RPC não retorna `reused/already_active` com dono. O insert usa `agrupamento_key = reeng_<lead>_<user>` para evitar repetição.
- Limpeza: delete em `notifications` tipo `lead_reengajado` com título "Fila do CEO" para Fabiane (af8e43ea…), e remoção dos duplicados da Thainá (c7d05189…).
- Deploy só do `whatsapp-webhook`. Sem migration.
