# Reengajamento: alerta falso de "não reativado" + produto errado na Fila do CEO

## O que os dados mostram (consultado agora)

Hoje houve 9 respostas do template `casatua_novidadeterraco` (fonte Base Única): 5 NÃO e 4 SIM.

Os 4 SIM **foram reativados corretamente** — existem no pipeline, em "Novo Lead", `aceite_status = pendente_distribuicao` (Fila do CEO), `reativado_por_nutricao = true`, `reengajamento_status = respondeu_sim`:

```text
Gleicy Mello   51993740037  Casa Tua  -> canônico: Casa Tua Porto Alegre (ok)
Paulo Sandro   51994240126  Casa Tua  -> canônico: Átrio  (INATIVO - errado)
Roberta Inae   51992301136  Casa Tua  -> canônico: Open Bosque (INATIVO - errado)
AGENTE (Joice) 51993112489  Casa Tua  -> canônico: Casa Tua Porto Alegre (ok)
```

Então são **dois problemas distintos**:

### Bug 1 — o alerta da auditoria é falso
O painel "Respostas recebidas" tenta achar o lead pelo `lead_id` do disparo, que na fonte Base Única é o id do contato na Base Única (não existe em `pipeline_leads`). O fallback por telefone também falha: o disparo guarda o número com DDI (`5551993740037`) e o pipeline guarda sem (`51993740037`). Resultado: mostra "SIM detectado mas lead não foi reativado" mesmo tendo reativado.

### Bug 2 — produto errado no lead reativado (esse trava a distribuição)
Ao criar o lead a partir da Base Única, a rotina copia o **empreendimento canônico histórico do contato** (o produto de onde ele veio um dia: Átrio, Open Bosque…), enquanto o texto vira "Casa Tua". Dois dos quatro leads de hoje ficaram apontando para empreendimentos **inativos e sem corretor alocado** — pela regra atual, esses leads travam na Fila do CEO com `sem_alocado_produto` e não conseguem ser distribuídos pelo produto certo. Além disso o texto gravado é "Casa Tua", que não é mais o nome canônico (hoje é "Casa Tua Porto Alegre" e "Casa Tua Canoas").

## O que será feito

1. **Corrigir a criação do lead vindo da Base Única**
   Na rotina `reativar_base_lead_para_fila_ceo`, resolver o empreendimento pelo **template do disparo** (mesma lógica já usada na reativação do pipeline) e gravar o canônico correspondente; só usar o produto histórico do contato quando o template for genérico. Se o canônico resolvido estiver inativo, gravar nulo em vez de manter produto errado.

2. **Padronizar o rótulo "Casa Tua" → "Casa Tua Porto Alegre"**
   No mapa de template→empreendimento (usado nas duas rotinas de reativação), templates `casatua_*` passam a apontar para o canônico ativo **Casa Tua Porto Alegre**, com o texto igual ao nome canônico.

3. **Backfill dos 4 leads de hoje**
   Ajustar os 2 leads com produto errado (Paulo e Roberta) para Casa Tua Porto Alegre e uniformizar o texto dos 4. Sem mexer em etapa, corretor ou histórico.

4. **Corrigir o alerta falso na auditoria**
   No painel de respostas, casar o disparo com o lead também por `base_leads.pipeline_lead_id` e comparar telefone pelos **últimos 8 dígitos** (imune ao DDI). Quando reativado via Base Única, mostrar "✅ Reativado (Base Única) → Fila do CEO" em vez do alerta vermelho.

5. **Validar ao vivo**
   Recarregar a aba de auditoria e confirmar 0 alertas para os 4 SIM de hoje; abrir a Fila do CEO e confirmar que os 4 aparecem com Casa Tua Porto Alegre e distribuíveis para corretores alocados a esse produto.

## Detalhes técnicos

- Migration única (DDL): `CREATE OR REPLACE FUNCTION public.reativar_base_lead_para_fila_ceo(...)` — resolver `v_emp_canon_id` por template (nome canônico exato → `empreendimento_aliases`), exigindo `ativo = true`; gravar `empreendimento` = nome canônico resolvido. Mesmo ajuste do rótulo Casa Tua em `reativar_lead_para_fila_ceo` (linha do `v_is_casatua`).
- Backfill via DML nos 4 `pipeline_leads` (ids `008994a9…`, `1e818085…`, `b2f537d5…`, `e1f48852…`).
- Frontend: `src/components/central-nutricao/RespostasRecebidasHoje.tsx` — buscar `base_leads(id, pipeline_lead_id)` para os `lead_id` sem match e trocar o fallback de telefone por `right(phone, 8)`.
- Nada muda em `distribuir_lead_atomico`, higiene, supressões ou no motor de disparo.
