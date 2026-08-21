-- Limpeza de segurança: remove snapshots de backup/rollback de migrações antigas
-- que ficaram no schema public. Duas estavam com RLS desligado (dado real exposto),
-- o que travava a publicação do app no scan de segurança. Nenhuma tem FK, view,
-- função ou código do app dependendo dela (verificado). Autorizado pelo Lucas.
drop table if exists public._backup_negocios_baseunica_16ago;
drop table if exists public._backup_lembretes_vencidos_18ago;
drop table if exists public._pdn_entries_backup_passo2;
drop table if exists public._rollback_b1final;
drop table if exists public._rollback_onda1;
