# Lia · gravar o prompt v3.1 como fonte de execução

O texto integral do LIA-Prompt-v3.1 chegou. Hoje o arquivo de prompt no projeto ainda é um placeholder de 398 bytes com o cabeçalho "PENDENTE", que é justamente a trava que impede ligar o cérebro da Lia. Este passo só grava o texto e registra a versão. Nada é ativado, nada dispara mensagem.

## O que vai ser feito

1. Substituir o conteúdo do arquivo de prompt pelo texto integral da v3.1, exatamente como enviado, das seções 1 a 18, sem resumir, sem reescrever e sem "melhorar" nenhuma frase. Removo apenas o cabeçalho de pendência.
2. Registrar no banco que a versão ativa é a `lia-canoas-v3.1`, com a data de hoje e uma nota de que o texto passou a existir no repositório. O banco continua guardando só o registro da versão, nunca o texto.
3. Conferência de integridade após gravar: as 18 seções presentes na ordem certa, o bloco JSON da seção 17 intacto (chaves e aspas), os seis valores de etapa iguais aos do enum já criado na Fase 0 (atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado) e nenhum travessão introduzido pela cópia.
4. Confirmar que os interruptores continuam desligados: envio desabilitado e kill switch geral ativo, como ficaram na Fase 0.

## O que NÃO entra aqui

- Nenhuma função nova, nenhum webhook, nenhuma chamada ao modelo.
- Nenhuma mudança nas tabelas da Lia nem no pipeline.
- Nada da Fase 1 (webhook e smoke gate) e nada da Fase 2 (cérebro, debounce, opt-out, shadow mode).

## Detalhes técnicos

- Arquivo: `supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt` — passa a conter o texto puro do prompt, sem front matter e sem comentários de código, porque será lido cru como system prompt.
- Placeholders mantidos literais no texto para substituição em runtime na Fase 2: `{{nome}}` e `{{horarios_disponiveis}}`.
- Registro de versão via linha em `ia_prompt_versoes` (operação de dados, não de schema), marcando `lia-canoas-v3.1` como ativa e desmarcando qualquer anterior.
- Validação automática de contrato (parse do JSON da seção 17, checagem dos valores de `etapa_ia` contra o enum `ia_etapa`) fica para a Fase 2, junto do cérebro; aqui a checagem é de conteúdo gravado.

## Depois disso

Fase 1: `lia-webhook` com validação de segredo por header e o smoke gate manual de WhatsApp antes de qualquer envio.
