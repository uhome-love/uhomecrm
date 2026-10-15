# Lake Baikal: todo lead novo vai obrigatoriamente para a Fila CEO

## Como está hoje (conferido)
- O Lake Baikal está na Roleta, no segmento S3 - Alto Padrão.
- O Leo Dorneles já está inativo no sistema e fora da equipe, mas ainda aparece no Foco Corretores como alocado em 2 empreendimentos, um deles o Lake Baikal. Como está inativo, ele não recebe leads, mas a alocação esquecida confunde a tela.
- O Leo ainda tem 9 clientes ativos no nome dele.
- Em alguns casos a distribuição é forçada (por exemplo, quando um corretor recusa o lead ou o tempo de aceite acaba). Aí o lead pode ir para qualquer corretor do S3.

## O que muda
1. Todo lead novo do Lake Baikal que chega por anúncio da Meta (campanha "Lake Baikal - v6"), pelo site ou por disparo vai direto para a **Fila CEO**, sempre, em qualquer turno. Nenhum corretor recebe pela Roleta, nem quando a distribuição é forçada.
2. Na Fila CEO, você repassa manualmente, por exemplo para a Gabrielle, como já funciona hoje.
3. **Leo Dorneles:** sai do Foco Corretores, com as alocações apagadas. Os 9 clientes que ainda estão no nome dele não mudam agora. Se quiser, depois a gente decide para quem passar.
4. **Não muda:** os clientes atuais do Lake Baikal continuam com quem já atende, o cadastro manual continua liberado e as regras de clientes parados seguem iguais.
5. Dá para desligar quando quiser: é uma chave própria, separada das outras regras da Roleta.

## Validação
- Criar um lead de teste com a campanha "Lake Baikal - v6", rodar a distribuição e confirmar que ele cai na Fila CEO e que nenhum corretor recebe. Depois apagar o lead de teste.
- Rodar o mesmo teste com outro empreendimento e confirmar que ele continua indo para a Roleta normalmente.

## Detalhes técnicos
- Nova chave em `roleta_config`: `fila_ceo_obrigatoria_canonicos` (lista de ids canônicos), começando com o Lake Baikal `8654bd9d-6d44-43dc-b741-97a86fec8c9d`.
- `distribuir_lead_atomico`: logo depois de resolver `v_emp_canonico_id`, se o canônico estiver nessa lista, faz o mesmo caminho que já existe para "sem alocado": `aceite_status = 'pendente_distribuicao'`, `motivo_pendencia = 'fila_ceo_obrigatoria'`, grava `distribuicao_historico` com ação `fila_ceo` e retorna. Isso vale também com `p_force = true`. A lógica do restante da função continua igual.
- Uma migração, só com a função e a chave nova, aplicada dentro do limite diário. Sem mudança no front, no Foco Corretores, em `roleta_campanhas`, no CAPI ou na Fila CEO.
