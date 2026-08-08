# Lia · gravar o prompt v3.1 como fonte de execução

O texto integral do LIA-Prompt-v3.1 chegou. Hoje o arquivo de prompt no projeto ainda é um placeholder com o bloco "PENDENTE", que é a trava que impede ligar o cérebro da Lia. Este passo grava o texto, registra a versão com hash e deixa anotada a regra das seis etapas. Nada é ativado, nada dispara mensagem.

## O que vai ser feito

1. Substituir o conteúdo do arquivo de prompt pelo texto integral da v3.1, exatamente como enviado, das seções 1 a 18, sem resumir e sem reescrever nenhuma frase. **A primeira linha "LIA · CASA TUA SANTOS FERREIRA (CANOAS) · v3.1" fica**, porque faz parte do prompt e diz ao modelo qual versão está executando. Sai apenas o bloco de PENDENTE.
2. Guardar o hash do conteúdo do arquivo no registro da versão, para que o carregamento na Fase 2 compare arquivo contra registro e alerte quando não bater. Sem isso, alguém edita o arquivo, o registro continua igual e a divergência passa em silêncio.
3. Registrar a `lia-canoas-v3.1` como versão ativa, com data de hoje, hash e nota de que o texto passou a existir no repositório. O banco continua sem guardar o texto.
4. Deixar registrada a regra das etapas: o enum `ia_etapa` tem nove valores, mas a Lia só pode emitir seis — atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado. Entrada, bloqueado e migrado são estados que o sistema define. A validação da Fase 2 é contra essa lista de seis, nunca contra o enum inteiro.
5. Conferência após gravar: as 18 seções na ordem certa, o bloco JSON da seção 17 intacto, e nenhum travessão introduzido pela cópia.
6. Confirmar que os interruptores continuam desligados: envio desabilitado e kill switch geral ativo, como ficaram na Fase 0.

## O que NÃO entra aqui

- Nenhuma função nova, nenhum webhook, nenhuma chamada ao modelo.
- Nenhuma mudança nas tabelas da Lia nem no pipeline.
- Nada da Fase 1 (webhook e smoke gate) e nada da Fase 2 (cérebro, debounce, opt-out, shadow mode).

## Detalhes técnicos

- Arquivo: `supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt` — texto puro, sem front matter e sem comentários de código, lido cru como system prompt. Primeira linha preservada como parte do prompt.
- Placeholders mantidos literais para substituição em runtime na Fase 2: `{{nome}}` e `{{horarios_disponiveis}}`.
- `ia_prompt_versoes` hoje não tem coluna de hash. Migration mínima: adicionar `hash_sha256 text` (nullable, para não quebrar a linha existente) e um índice não é necessário. Em seguida, operação de dados marcando `lia-canoas-v3.1` como ativa, com `hash_sha256` preenchido e `ativada_em` de hoje, desmarcando qualquer outra.
- Lista canônica das seis etapas emissíveis fica declarada em constante no diretório do `lia-brain` (ex.: `ETAPAS_IA_EMISSIVEIS`), para o validador da Fase 2 importar em vez de consultar o enum. Consumo dessa constante é Fase 2; aqui ela só nasce documentada junto do prompt.
- Validação automática do contrato JSON da seção 17 continua sendo Fase 2; aqui a checagem é do conteúdo gravado.

## Depois disso

Fase 1: `lia-webhook` com validação de segredo por header e o smoke gate manual de WhatsApp antes de qualquer envio.
