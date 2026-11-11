# Trava de número de teste da Lia (desenho aprovado)

## Correção importante do que eu disse antes
O botão "Envio de mensagens" que eu tinha conferido só vale para a Lia antiga. A Lia que usa o WhatsApp oficial tem outros interruptores:
- **Recuperação:** está **LIGADA**. Não envia nada hoje só porque não há campanha ativa.
- **Respostas a clientes:** não têm botão geral. Ela responde sempre que um cliente de um dos 10 produtos ativos escrever. Não há conversas desde 11/10, o que indica que o número não está recebendo mensagens agora.
- **Seguimento automático** (mensagens de retomada): também não tem botão geral.

Por isso a trava precisa ficar no **ponto de saída de toda mensagem**, e não em um botão só.

## O que vai ser feito
1. **Trava "Modo teste"** em Lia › Configurações, igual ao desenho: liga/desliga + número (já preenchido com +55 51 99259-7097).
   - Ligada: **toda** mensagem da Lia (resposta, seguimento, recuperação, boas-vindas de formulário) para qualquer número diferente do seu é barrada e registrada como "bloqueada pelo modo teste".
   - Ela já começa **ligada**, protegendo os clientes desde já.
2. **Botão "Enviar teste para meu número"**: manda a 1ª mensagem da recuperação (dia 1, 3 botões, modelo aprovado pela Meta) só para o número de teste. Não entra na Fila CEO nem vai para corretores. Só funciona com a trava ligada.
3. **"Ver conversa"** abre a sua conversa de teste em Conversas.
4. Botão "Envio de mensagens" no desenho = o interruptor da Recuperação (hoje ligado). Mostro o estado real; não mudo sozinho.
5. Só CEO/diretora veem e mexem nessa área. Toda mudança fica registrada (quem, quando).

## Validação
- Testes automáticos: número diferente → barrado; seu número → passa; trava desligada → comportamento atual.
- Ao vivo: computador 1280px e celular 390px; aperto "Enviar teste", confirmo com você que chegou, você responde e eu confiro que a Lia respondeu só a você.
- Desligar a trava continua sendo decisão sua.

## Detalhes técnicos
- Migration: `ia_config.modo_teste boolean default true`, `ia_config.numero_teste text` (backfill 5551992597097); RPC `lia_salvar_modo_teste` admin/diretor com auditoria.
- `_shared/liaModoTeste.ts` (puro): `podeEnviar(cfg, to)` compara últimos 8 dígitos; cache por execução. Aplicado em `send360` (lia-whatsapp), `send360Text/Image/Doc` + `sendTemplate` (lia-followup), `sendTemplate` (lia-reengajar-dispatch), `enviarTemplate` (liaFormBridge). Bloqueio grava em `ia_eventos`/log.
- Ação `teste` em `lia-reengajar-dispatch` (JWT admin/diretor) que envia o template D+1 ao `numero_teste`, sem fila/run.
- UI: card no topo de `LiaConfiguracoesTab.tsx` via `useLiaConfiguracoes`.
- 2 migrations hoje já usadas (3 com a Prime): esta seria a 4ª em horário comercial — preciso do seu ok ou aplico após 19h.
