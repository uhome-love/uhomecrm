## Correções de leads

Stage Descarte = `1dd66c25-3848-4053-9f66-82e902989b4d`.

### Ações (UPDATE direto em `pipeline_leads`)

| # | Lead | ID | Ação |
|---|---|---|---|
| 1 | Karla Mazzotti | `4d5bb139-ee52-4ca0-ab9b-1186d112bccd` | Descarte reengajavel — stage=Descarte, `arquivado=true`, `tipo_descarte='reengajavel'`, `motivo_descarte='Descarte: desistiu \| Empreendimento: Connect JW'` (mantém) |
| 2 | Rodrigo Xavier (recente, Casa Tua) | `b50025e3-c595-445c-b51b-6b832869f766` | Descarte reengajavel — stage=Descarte, `arquivado=true`, `tipo_descarte='reengajavel'`, mantém `motivo_descarte` atual |
| 3 | Mirdes | `974059a4-03e7-467f-a061-762df6378daf` | Descarte **definitivo** — stage=Descarte, `arquivado=true`, `tipo_descarte='definitivo'`, `motivo_descarte='Respondeu negativamente ao reengajamento'` |
| 4 | Eliza (#1 Novo Lead) | `4fa3a6a3-971f-49cf-93fa-f65ceab9511c` | Descarte reengajavel — stage=Descarte, `arquivado=true`, `tipo_descarte='reengajavel'`, `motivo_descarte='Lead duplicado / sem interesse'` |
| 5 | Marcio Zang #1 (Sem Contato, já arquivado definitivo) | `497efb1a-d8e1-4817-a50f-49454d5301ae` | Reclassificar para reengajavel — `tipo_descarte='reengajavel'` (mantém arquivado e motivo "é corretor"), stage=Descarte |
| 6 | Marcio Zang #2 (Novo Lead, reaparecido) | `d0541518-7bc5-4587-b51c-1ef59277b764` | Descarte reengajavel — stage=Descarte, `arquivado=true`, `tipo_descarte='reengajavel'`, `motivo_descarte='Corretor buscando para cliente'` |

Todos recebem `updated_at = now()`. Em todos com troca de stage, inserir registro em `pipeline_historico` (stage_anterior → Descarte, observação "Descarte manual via correção de bug de reengajamento").

### Não incluído neste plano
- Investigação do bug raiz (criação/reativação via WhatsApp não limpa `arquivado`/`motivo_descarte`) — fica para sessão separada conforme combinado.

Confirma para executar?