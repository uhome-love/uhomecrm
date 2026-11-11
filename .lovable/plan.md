# Lia: fazer o cérebro aceitar as rotinas internas (correção definitiva)

## O que os registros mostram
- Nas suas duas mensagens (17:12:17 e 17:12:38), o WhatsApp da Lia pediu a resposta ao cérebro e **o próprio cérebro recusou** o pedido em menos de 10 milésimos.
- Ou seja: o crachá chegou, mas o cérebro não reconheceu nenhuma das duas identificações enviadas (a senha interna da Lia e a chave do sistema).
- Causa mais provável, que vou confirmar primeiro:
  1. A chave do sistema é trocada no caminho por uma "credencial de sistema" equivalente, então a comparação exata falha.
  2. A senha interna pode ter um espaço ou quebra de linha no fim, que some ao viajar no pedido, e a comparação exata também falha.

## O que vou fazer
1. **Diagnóstico seguro:** o cérebro passa a registrar só "sim/não" para cada identificação (senha presente, senha confere, credencial de sistema válida). Nunca registra a senha nem parte dela.
2. **Reconhecer a credencial de sistema de verdade:** em vez de comparar texto, o cérebro confere a assinatura da credencial e aceita quando ela é do próprio sistema. Isso vale para todas as rotinas da Lia que usam a mesma trava (seguimento, recuperação, retomada).
3. **Senha interna tolerante a espaços:** comparar ignorando espaços e quebras de linha no começo e no fim.
4. **Pedidos de fora continuam bloqueados:** sem a senha e sem uma credencial de sistema assinada, a recusa continua. Usuário comum logado continua recusado, e só CEO e diretora passam.
5. Colocar no ar todas as rotinas da Lia juntas.

## Validação ponta a ponta (antes de te chamar)
1. Pedido de fora sem identificação: tem que ser recusado.
2. **Laboratório da Lia** (usa o mesmo caminho interno do WhatsApp e não envia nada a ninguém): tem que voltar com uma resposta de verdade da Lia, sem "instabilidade".
3. Conferir nos registros que o cérebro aceitou pela via interna.
4. Conferir que a trava de teste continua ligada, só com o seu número.
5. Só depois disso eu te peço para mandar "oi". Eu confiro a resposta nos registros e em Lia › Conversas.

## O que não muda
- O envio para clientes não é ligado. Nenhuma mudança no banco, na Roleta, na Fila CEO ou nos corretores.

## Detalhes técnicos
- `_shared/ai-auth.ts` `requireRealUser`: com `allowServiceRole`, após o match exato, validar o token via `getClaims` e aceitar `claims.role === "service_role"` (assinatura verificada). Comparações de segredo com `.trim()`.
- `lia-chat`: `interno` compara `LIA_CRON_SECRET.trim()` com o header `.trim()`; log JSON só com booleanos (`secret_set`, `header_set`, `secret_ok`, `service_ok`) quando recusar.
- Deploy: lia-chat, lia-whatsapp, lia-followup, lia-laboratorio, lia-reengajar-dispatch, lia-reengajar-arm.
- Teste interno: `curl` em `lia-laboratorio` com `modo: "followup"` como admin (chama lia-chat com `liaInternoHeaders`).
