# Cadastro do empreendimento "Investimento Cyrela"

## O que já conferi (leitura)
- Não existe empreendimento com "Cyrela" no nome. Skyglass está em ordem 20, ativo.
- Nenhum dos 5 aliases pedidos existe hoje. O único alias com "cyrela" é "Skyglass Cyrela" → Skyglass (não será tocado). Sem conflito.
- Roleta: chave "Investimento Cyrela" → S2 (id b40be36b…) existe e está **ativa**. Nada a criar.
- Backfill: **0 leads** dos últimos 60 dias sem empreendimento com campanha/empreendimento começando por "Investimento Cyrela". O passo roda mesmo assim (inofensivo).
- Tela de alocação (Foco Corretores) lê `empreendimentos_canonicos` com ativo = true → o novo aparece sozinho.
- Listas fixas no front encontradas (seletor de empreendimento, atribuição em massa do CEO, Oferta Ativa): vou incluir "Investimento Cyrela" nelas.

## Observação importante
Inserir o empreendimento e os aliases é **mudança de dados**, não de estrutura. Pela regra do projeto (migration só estrutura), isso vai como comandos de dados com aprovação, não como migration — também não consome a cota de 2 migrations/dia. O SQL é este:

```sql
-- 1. Empreendimento (não duplica)
INSERT INTO empreendimentos_canonicos (nome, segmento_id, construtora, ativo, origem, ordem)
SELECT 'Investimento Cyrela', '409aeddf-077f-473a-97cc-dfc0692ed35e', 'Cyrela', true, 'cadastro', 21
WHERE NOT EXISTS (SELECT 1 FROM empreendimentos_canonicos WHERE lower(nome) = 'investimento cyrela');

-- 2. Aliases (não sobrescreve alias de outro empreendimento)
WITH e AS (SELECT id FROM empreendimentos_canonicos WHERE nome = 'Investimento Cyrela'),
v(tipo, raw) AS (VALUES
  ('campanha','Investimento Cyrela | 2026-11'),
  ('campanha','Investimento Cyrela'),
  ('empreendimento_texto','Investimento Cyrela'),
  ('formulario','1812358563147839'),
  ('formulario','Uhome - Investimento Cyrela - Studios'))
INSERT INTO empreendimento_aliases (alias_raw, alias_norm, tipo, empreendimento_id)
SELECT v.raw, normalize_alias(v.raw), v.tipo, e.id FROM v, e
WHERE NOT EXISTS (SELECT 1 FROM empreendimento_aliases a
                  WHERE a.alias_norm = normalize_alias(v.raw) AND a.tipo = v.tipo);
-- depois: listar qualquer alias igual apontando para outro empreendimento e avisar

-- 4. Backfill (só empreendimento_canonico_id)
UPDATE pipeline_leads SET empreendimento_canonico_id = (SELECT id FROM empreendimentos_canonicos WHERE nome='Investimento Cyrela')
WHERE empreendimento_canonico_id IS NULL AND created_at > now() - interval '60 days'
  AND (campanha ILIKE 'Investimento Cyrela%' OR empreendimento ILIKE 'Investimento Cyrela%');
```

## Não altero
distribuir_lead_atomico, trg_auto_distribute_lead, pipeline_segmentos, Skyglass, Connect JW, outras campanhas/aliases, roleta_campanhas. Nenhum corretor alocado.

## Validação (mostrarei os resultados)
a) e b) resolvedores com "| 2026-11" → id novo
c) "| 2026-12" → id novo. Se o resolvedor não casar por prefixo, **não** mexo na função: aviso e proponho como passo separado (o alias "Investimento Cyrela" + form_id já devem garantir isso).
d) "Skyglass - Natal" → continua 00883e04…
e) "Investimento Cyrela | 2026-11" bate com exatamente 1 chave ativa da Roleta
f) print da tela de alocação com "Investimento Cyrela" disponível (sem salvar nada)
