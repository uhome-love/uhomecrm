-- LIA multiproduto: cada imóvel que a LIA atende é uma linha aqui. O cérebro
-- (ficha) é subido pelo hub; as edge functions da LIA leem esta tabela para
-- rotear a conversa pro produto certo (pelo referral do anúncio → campanha_ids).
-- Aditivo: enquanto o lia-chat/lia-whatsapp não usarem a tabela, nada muda.
create table if not exists public.lia_produtos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  empreendimento text not null,
  ficha text,
  midias jsonb not null default '{}'::jsonb,
  campanha_ids text[] not null default '{}',
  template_reativacao text,
  perguntar_se_sem_anuncio boolean not null default true,
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lia_produtos enable row level security;

drop policy if exists "admin diretor manage lia_produtos" on public.lia_produtos;
create policy "admin diretor manage lia_produtos" on public.lia_produtos
  for all to authenticated
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'diretor'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'diretor'::app_role));

drop policy if exists "service role manage lia_produtos" on public.lia_produtos;
create policy "service role manage lia_produtos" on public.lia_produtos
  for all to service_role using (true) with check (true);

insert into public.lia_produtos (slug, nome, empreendimento, campanha_ids, template_reativacao, ativo)
values
 ('casa-tua-canoas','Casa Tua Santos Ferreira','Casa Tua Santos Ferreira', array['120251100587060030'], 'followup_casatuacanoaslia', true),
 ('awa-wellness','AWA Wellness Home','AWA Wellness Home', array[]::text[], null, false)
on conflict (slug) do nothing;
