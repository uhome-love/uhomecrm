## Diagnóstico

Os 4 leads mostrados como "⚠️ SIM detectado mas lead não foi reativado" **na verdade foram reativados com sucesso**. É um falso alarme do relatório `RespostasRecebidasHoje`.

### O que aconteceu (evidência do banco)

Os 4 `lead_id`s vieram de disparos com `audience_source` = `combo` ou `oferta_ativa_lista`:

| Telefone | lead_id (do disparo) | Existe em `pipeline_leads`? | Está em `oferta_ativa_leads`? |
|---|---|---|---|
| 5551989753773 | 4173f27c… | ❌ Não | ✅ status = `reativado` |
| 5551999589498 | a3b8d2af… | ❌ Não | ✅ status = `reativado` |
| 5554991078885 | 549e15cf… | ❌ Não | ✅ status = `reativado` |
| 5551993290145 | d3b36303… | ❌ Não | ✅ status = `reativado` |

Fluxo real que o `whatsapp-webhook` executou (linhas 867-879):

```text
Lead veio de Oferta Ativa
  └─ pipeline_leads.id == metaDispatch.lead_id? NÃO (é ID de oferta_ativa_leads)
       └─ chama rpc reativar_oferta_ativa_para_fila_ceo(p_oa_lead_id=…)
            └─ RPC cria NOVO pipeline_lead (id diferente) + marca OA como 'reativado'
            └─ effectiveLeadId = NOVO pipeline_lead.id
```

Ou seja: o `pipeline_leads` reativado tem um **id novo**, diferente do `metaDispatch.lead_id`.

### Bug no relatório

`RespostasRecebidasHoje.tsx` (linhas 88-94) busca `pipeline_leads.id IN (metaDispatch.lead_id)`. Para disparos de Oferta Ativa esse ID **nunca vai bater** — a query retorna vazio, `lead?.reativado_por_nutricao` fica `undefined`, e a linha 109 exibe "⚠️ SIM detectado mas lead não foi reativado" mesmo quando a reativação ocorreu perfeitamente.

O caso do Evandro (`c4a5c7db…`) aparece **verde/reativado** justamente porque ele já existia no pipeline (audience_source de descarte), então o ID bate.

## Correção proposta

Ajustar **apenas** `src/components/central-nutricao/RespostasRecebidasHoje.tsx` para reconhecer reativação vinda de Oferta Ativa:

1. Após buscar `disparos`, identificar telefones cujos `lead_id` **não** existem em `pipeline_leads`.
2. Fazer uma segunda busca em `oferta_ativa_leads` pelos IDs restantes, trazendo `status` e `telefone_normalizado`.
3. Adicionalmente, buscar em `pipeline_leads` por `reativado_por_nutricao=true` + `telefone_normalizado IN (…)` + `reativado_em >= sinceIso` para pegar o pipeline_lead novo criado pela RPC.
4. Considerar o lead "reativado" quando qualquer uma das condições for verdadeira:
   - `pipeline_leads.reativado_por_nutricao = true` (direto pelo ID — caso atual), OU
   - `oferta_ativa_leads.status = 'reativado'` para o `lead_id` do disparo, OU
   - existe `pipeline_leads` recente com o mesmo telefone e `reativado_por_nutricao = true`.
5. Ajustar a mensagem: quando reativado via OA, mostrar `✅ Reativado via Oferta Ativa → Fila do CEO`.

Nenhuma alteração em edge function, RPC ou banco. Só leitura extra + lógica de exibição.

## Validação após o fix

- Recarregar `/central-nutricao` na aba de respostas.
- Os 4 registros hoje (5551989753773, 5551999589498, 5554991078885, 5551993290145) devem aparecer como ✅ reativados.
- Continuar mostrando alerta real quando houver SIM sem nenhum sinal de reativação em nenhuma das 3 fontes (esse sim seria bug de verdade).

## Fora de escopo

- Não mexer no `whatsapp-webhook` — está correto.
- Não mexer nas RPCs `reativar_lead_para_fila_ceo` / `reativar_oferta_ativa_para_fila_ceo`.
- Não alterar dados existentes.