# Golden Lake: leads só para a Fila CEO, com o anúncio certo de cada lead

## Como está hoje (conferido)
- Ainda não entrou nenhum lead da campanha Golden Lake no CRM.
- O Golden Lake existe na lista oficial de empreendimentos, mas está **desligado** e sem nenhum nome de campanha ligado a ele. Assim, quando um lead chegar, o CRM pode não reconhecer que é do Golden Lake.
- A regra "vai só para a Fila CEO" hoje vale só para o Lake Baikal.
- O anúncio já é salvo em cada lead que vem da Meta (exemplo de hoje: "Ad 3 - Video Aluguel" no Open Arvoredo). Ele aparece na ficha do cliente, na parte de Origem.

## O que muda
1. **Golden Lake reconhecido:** ligo o nome da campanha ("Golden Lake") ao empreendimento oficial, para todo lead dessa campanha ser marcado como Golden Lake.
2. **Só para o CEO:** coloco o Golden Lake na mesma chave do Lake Baikal. Todo lead novo vai direto para a Fila CEO, em qualquer turno, até na distribuição forçada. Nenhum corretor recebe pela Roleta.
3. **Anúncio de cada lead:** cada lead mostra o nome exato do criativo (um dos 10) na ficha, e no registro de entrada da linha do tempo. Se o mesmo cliente preencher de novo por outro criativo, o registro novo mostra o criativo novo.
4. **Não muda:** os outros empreendimentos continuam indo para a Roleta; o Golden Lake não entra no Foco dos corretores.

## Importante para os 10 criativos
O CRM mostra o nome que está no anúncio da Meta. Se os 10 anúncios tiverem nomes diferentes (por exemplo "Ad 1 - Video Fachada", "Ad 2 - ..."), cada lead vai mostrar o certo. Se tiverem o mesmo nome, fica impossível separar.

## Validação
- Lead de teste com campanha "Golden Lake" e um nome de anúncio: confirmar que cai na Fila CEO, que nenhum corretor recebe e que o anúncio aparece na ficha. Depois apagar.
- Teste igual com outro empreendimento, confirmando que continua indo para a Roleta.
- Quando o primeiro lead real chegar, confiro o anúncio dele.

## Detalhes técnicos
- Canônico Golden Lake `755ff327-525e-471f-a54e-980c431e7535`: adicionar alias em `empreendimento_aliases` (ex.: "golden lake") para o trigger de canônico resolver a partir de `campanha`.
- `roleta_config.fila_ceo_obrigatoria_canonicos`: acrescentar o id do Golden Lake ao lado do Lake Baikal (só dado, sem migration; `distribuir_lead_atomico` já trata a lista).
- Conferir se a resolução de canônico ignora `ativo=false`; se ignorar, manter inativo (fica fora de Roleta/Foco/pickers) e ajustar só a resolução, ou ligar sem alocação de corretor.
- `anuncio` já é gravado por `receive-meta-lead`; sem mudança de código se o nome vier preenchido.
