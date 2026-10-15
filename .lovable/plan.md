# Lake Baikal: todo lead novo vai obrigatoriamente para a Fila CEO

## Como está hoje (conferido)
- O Lake Baikal está na Roleta, no segmento S3 - Alto Padrão.
- O Leo Dorneles está alocado no Lake Baikal no Foco Corretores. Se ele estiver credenciado no turno, os leads da campanha nova "Lake Baikal - v6" vão para ele. O lead só cai na Fila CEO quando ele não está na Roleta.
- Em alguns casos a distribuição é forçada (por exemplo, quando um corretor recusa o lead ou o tempo de aceite acaba). Aí o lead pode ir para qualquer corretor do S3.

## O que muda
1. Todo lead novo do Lake Baikal que chega por anúncio da Meta, pelo site ou por disparo vai direto para a **Fila CEO**, sempre, em qualquer turno. Nenhum corretor recebe pela Roleta, nem quando a distribuição é forçada.
2. Na Fila CEO, você repassa manualmente, por exemplo para a Gabrielle, como já funciona hoje.
3. **Não muda:** os clientes atuais do Lake Baikal continuam com quem já atende, a alocação do Leo continua no Foco Corretores, o cadastro manual continua liberado e as regras de clientes parados seguem iguais.
4. Dá para desligar quando quiser: é uma chave própria, separada das outras regras da Roleta.

## Validação
- Criar um lead de teste com a campanha "Lake Baikal - v6", rodar a distribuição e confirmar que ele cai na Fila CEO e que nenhum corretor recebe. Depois apagar o lead de teste.
- Rodar o mesmo teste com outro empreendimento e confirmar que ele continua indo para a Roleta normalmente.

## Detalhes técnicos
- Nova chave em `roleta_config`: `fila_ceo_obrigatoria_canonicos` (lista de ids canônicos), começando com o Lake Baikal `8654bd9d-6d44-43dc-b741-97a86fec8c9d`.
- `distribuir_lead_atomico`: logo depois de resolver `v_emp_canonico_id`, se o canônico estiver nessa lista, faz o mesmo caminho que já existe para "sem alocado": `aceite_status = 'pendente_distribuicao'`, `motivo_pendencia = 'fila_ceo_obrigatoria'`, grava `distribuicao_historico` com ação `fila_ceo` e retorna. Isso vale também com `p_force = true`. A lógica do restante da função continua igual.
- Uma migração, só com a função e a chave nova, aplicada dentro do limite diário. Sem mudança no front, no Foco Corretores, em `roleta_campanhas`, no CAPI ou na Fila CEO.
