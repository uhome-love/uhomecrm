create or replace function public.list_manageable_users()
returns table (
  user_id uuid,
  nome text,
  email text,
  telefone text,
  cpf text,
  creci text,
  jetimob_user_id text,
  role text,
  equipe text,
  gerente_id uuid,
  gerente_nome text,
  ativo boolean,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_diretora boolean;
  v_gerentes uuid[];
begin
  if v_uid is null then
    return;
  end if;

  v_is_admin := public.has_role(v_uid, 'admin');
  select exists (select 1 from public.diretoria_equipes d where d.diretor_auth_id = v_uid)
    into v_is_diretora;

  if v_is_admin then
    return query
      select
        p.user_id,
        p.nome,
        p.email,
        p.telefone,
        p.cpf,
        p.creci,
        p.jetimob_user_id,
        coalesce((
          select ur.role::text from public.user_roles ur
          where ur.user_id = p.user_id
          order by case ur.role::text
            when 'admin' then 1 when 'gestor' then 2
            when 'backoffice' then 3 when 'rh' then 4 else 5 end
          limit 1
        ), 'corretor') as role,
        tm.equipe,
        tm.gerente_id,
        gp.nome as gerente_nome,
        p.ativo,
        coalesce(tm.status, 'ativo') as status
      from public.profiles p
      left join public.team_members tm on tm.user_id = p.user_id
      left join public.profiles gp on gp.user_id = tm.gerente_id;
    return;
  end if;

  if v_is_diretora then
    select array_agg(d.gerente_auth_id) into v_gerentes
    from public.diretoria_equipes d where d.diretor_auth_id = v_uid;
  elsif public.has_role(v_uid, 'gestor') then
    v_gerentes := array[v_uid];
  else
    return;
  end if;

  return query
    select
      p.user_id,
      p.nome,
      p.email,
      p.telefone,
      p.cpf,
      p.creci,
      p.jetimob_user_id,
      coalesce((
        select ur.role::text from public.user_roles ur
        where ur.user_id = p.user_id
        order by case ur.role::text
          when 'admin' then 1 when 'gestor' then 2
          when 'backoffice' then 3 when 'rh' then 4 else 5 end
        limit 1
      ), 'corretor') as role,
      tm.equipe,
      tm.gerente_id,
      gp.nome as gerente_nome,
      p.ativo,
      coalesce(tm.status, 'ativo') as status
    from public.team_members tm
    join public.profiles p on p.user_id = tm.user_id
    left join public.profiles gp on gp.user_id = tm.gerente_id
    where tm.gerente_id = any(v_gerentes);
end;
$$;

grant execute on function public.list_manageable_users() to authenticated;
