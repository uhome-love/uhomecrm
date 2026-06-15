# Migrar leads do Samuel para as listas existentes da Oferta Ativa + desativar acesso

## Usuário
- **Samuel Azambuja** — `samuel.uhome@gmail.com`
- `auth.users.id` = `1788b1f3-f792-4927-9367-003676d07924`
- `profiles.id` = `c7e64e1f-ad3c-4b76-adb3-85b003c3d24e`
- 290 leads no pipeline (233 já arquivados, 0 com negócio)
- 57 leads sob atendimento dele na Oferta Ativa

## Decisões confirmadas
- **NÃO** criar lista "Leads Samuel"
- Distribuir **por empreendimento**, encaixando em **listas já existentes**
- Sem correspondência / sem empreendimento → **S3 - Avulso** (`Leads não aproveitados - Junho 2026`)
- Manter histórico arquivado no pipeline
- Desativar o acesso do usuário (sem apagar a conta de login)

## Passo 1 — Distribuir os 290 leads nas listas existentes
Inserir em `oferta_ativa_leads` (status `na_fila`, `corretor_id` NULL) copiando
`nome, telefone, telefone2, email, telefone_normalizado, empreendimento, campanha, origem, observacoes, interesse_tipo`,
definindo `lista_id` conforme o empreendimento do lead:

```text
Empreendimento (Samuel)        Qtd   Lista de destino existente
-----------------------------  ----  ----------------------------------------------
Casa Tua / CASA TUA            137   🏡 Casa Tua - Operação Especial
Lake Eyre / "Lake"              38   Lake Eyre
Orygem                          33   Orygem
High Garden Iguatemi            17   High Garden Iguatemi - Leads Não Aproveitados
Open Bosque                     13   Open Bosque - Leads Não Aproveitados
Las Casas / Vértice - Las Casas 10   Las Casas - Descartados Recuperados
Lév / lev                        7   Facebook Lead Ads: Uhome - Lév Gravataí
Alto Lindóia / Alto Lindoia      6   Alto Lindóia - Leads Não Aproveitados
High Garden Rio Branco           4   High Garden Rio Branco
Avulso - ImovelWeb               2   Avulso ImovelWeb - Descartados Recuperados
Arbo 3D                          1   Arbo 3D
Botanique - Me Day               1   Botanique - Me Day
Boa Vista                        1   Boa Vista Country Club - Leads Não Aproveitados
-----------------------------  ----  ----------------------------------------------
Sem lista / sem empreendimento  ~19  S3 - Avulso: Leads não aproveitados - Junho 2026
  (inclui: NULL, "ca", Seen Três Figueiras, MRV)
```

O casamento é feito por nome de empreendimento (case/acento-insensível, com correção dos casos `lev`→Lév, `Alto Lindoia`→Alto Lindóia). Valores inválidos/genéricos (`ca`, NULL, empreendimentos sem lista) caem em S3 - Avulso.

Atualizar `total_leads` de cada lista impactada somando os novos leads.

## Passo 2 — Arquivar os leads no pipeline
`UPDATE pipeline_leads SET arquivado = true` para os leads do Samuel ainda ativos (os 57 não arquivados). Os 233 já arquivados permanecem. Nenhum lead é deletado.

## Passo 3 — Liberar o atendimento dele na Oferta Ativa
Nos 57 `oferta_ativa_leads` em que ele é `corretor_id`/`em_atendimento_por`: limpar `corretor_id`, `em_atendimento_por`, `em_atendimento_ate` e voltar `status` para `na_fila`.

## Passo 4 — Desativar o acesso
- `DELETE FROM user_roles` do usuário (perde permissão/rotas)
- `UPDATE team_members SET status='inativo'` no vínculo dele
- Inativar os 135 `roleta_credenciamentos` dele (não recebe mais leads)
- `UPDATE profiles SET ativo=false`

A conta de login não é apagada; ele só perde acesso e funções no CRM.

## Detalhes técnicos
- Tudo via operações de dados (INSERT/UPDATE/DELETE), sem migration de schema.
- `pipeline_leads.corretor_id` e `oferta_ativa_leads.corretor_id` usam **auth.users.id**; `roleta_credenciamentos.corretor_id` usa **profiles.id** — IDs já resolvidos.
- Validação final: ~290 novas linhas distribuídas em `oferta_ativa_leads`, `total_leads` das listas atualizado, 0 leads ativos no pipeline do Samuel, 0 roles e profile inativo.
