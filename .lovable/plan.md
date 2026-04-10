

## Plano: Aplicar Migração Cirúrgica da Roleta (5 Correções)

A migração SQL que você escreveu está completa e validada contra o estado atual do banco. Vou aplicá-la usando a ferramenta de migração do banco de dados.

### O que será executado

Uma única migração SQL com 5 partes:

1. **Cleanup de credenciamentos** — Fecha duplicados (40-79 por corretor → 1-2), desativa linhas órfãs na `roleta_fila`
2. **Fix trigger offline (Bug #3)** — Converte `NEW.user_id` → `profiles.id` antes de filtrar `roleta_fila`
3. **Fix rejeitar_lead (Bug #2)** — Aceita `'aguardando_aceite'` além de `'pendente'`
4. **Fix trigger distribuição (Bugs #1 e #4)** — EXCEPTION limpa todos os campos; guard para `pendente_distribuicao`; preserva advisory lock, LIKE bidirecional, DISTINCT ON
5. **Recriar trigger** — Adiciona `AND NEW.aceite_status IS DISTINCT FROM 'pendente_distribuicao'` no WHEN

### Notas técnicas

- A Parte 1 (UPDATE de dados) precisa ser executada via ferramenta de insert/update, não migração
- As Partes 2-5 (DDL: CREATE OR REPLACE FUNCTION, DROP/CREATE TRIGGER) vão na migração
- Toda a lógica existente preservada: `pg_advisory_xact_lock`, LIKE bidirecional, `rc.data = v_today_date`, DISTINCT ON + ORDER BY
- Nenhuma alteração de frontend

