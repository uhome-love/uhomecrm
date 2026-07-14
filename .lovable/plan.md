## Diagnóstico da auditoria

- O template novo `lakebaikal_novidade3` existe no fluxo e não está bloqueado na blacklist.
- Houve um disparo recente com esse template: 32 itens na fila, 5 enviados, 27 ignorados por telefone inválido.
- Dos 5 enviados, a Meta já retornou: 2 lidos, 1 ainda enviado, 2 falhas externas da Meta (`Message undeliverable` / `User's number is part of an experiment`).
- Não apareceu erro 500 nos logs de edge function nas últimas consultas; o erro visto pelo usuário provavelmente vem do frontend exibindo genericamente `Edge Function returned a non-2xx status` ou de uma continuação/preview sem mensagem clara.
- A configuração geral está com `enabled=false`, mas disparos manuais passam por `force=true`; isso é coerente com a regra atual de disparo manual.

## Plano de correção

1. **Melhorar o erro real no frontend**
   - Ajustar o card de disparo para extrair o corpo real das falhas de edge function, em vez de mostrar só “Edge Function returned a non-2xx status”.
   - Mostrar mensagens claras: template ausente, imagem/header incompatível, bloqueio Meta, sem público elegível, fila travada ou credencial/configuração.

2. **Auditoria pré-disparo para Lake Baikal**
   - Adicionar uma validação antes de disparar:
     - template selecionado aprovado/listado pela Meta;
     - não está em `blocked_templates`;
     - existe imagem de header mapeada, quando o template exigir imagem;
     - preview e disparo usam a mesma regra de elegibilidade.
   - Se o template for `lakebaikal_novidade3`, manter o header atual mapeado e validar fallback sem travar o disparo se a Meta rejeitar header inexistente.

3. **Corrigir divergência entre preview e disparo**
   - Auditar e alinhar `reengajamento-audience-preview` com `reengajamento-descartados-enqueue`, especialmente em Oferta Ativa/listas:
     - paginação acima de 1000 leads;
     - filtro de frequência;
     - telefones inválidos;
     - dedup por template/telefone.
   - O preview deve explicar quantos saem por telefone inválido para evitar “preview mostra X, disparo envia muito menos”.

4. **Blindar a fila para não interromper o disparo**
   - Garantir que falhas individuais da Meta não derrubem a função inteira: cada item deve virar `failed` ou `suppressed`, e a fila continua.
   - Garantir que itens em `processing` sejam liberados quando a função bater timeout/retomar.
   - Revisar a continuação automática por micro-lotes para sempre carregar `iniciado_por` manual e não cair no gate automático.

5. **Adicionar ação de retomada limpa**
   - Se houver run travado/running com fila pendente, a UI deve oferecer “Retomar disparo” e chamar a mesma função com `run_id`.
   - Se não houver pendentes, marcar como concluído/erro de forma limpa.

6. **Validação final**
   - Testar `meta-templates-list` autenticado.
   - Testar preview do Lake Baikal sem disparar.
   - Testar chamada de disparo com limite pequeno e confirmar que:
     - cria run;
     - preenche fila;
     - envia ou ignora item a item;
     - não retorna erro genérico;
     - registra `reengajamento_meta_disparos` e status da fila.

## Arquivos previstos

- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`
- `supabase/functions/reengajamento-audience-preview/index.ts`
- `supabase/functions/reengajamento-descartados-enqueue/index.ts`

## Observação operacional

Antes de disparar em volume, o Lake Baikal deve rodar em lote pequeno para validar entrega real da Meta. A auditoria indica que o sistema disparou 5 mensagens com o template novo, então o problema principal é robustez/clareza do fluxo e elegibilidade da base, não aprovação do template.