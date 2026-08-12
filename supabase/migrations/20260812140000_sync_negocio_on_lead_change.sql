-- Base Única do Negócio — SYNC: o negócio espelha o lead.
-- Regra (Lucas 12/08/2026): lead descartado/arquivado → negócio 'perdido';
-- lead regredido (saiu do fluxo comercial pra etapa anterior) → negócio 'arquivado'.
-- Ganho (venda real) NUNCA é fechado (filtrado por fase). Pra ter negócio de novo, "virar negócio".

create or replace function public.sync_negocio_on_lead_change()
returns trigger as $$
declare new_tipo text;
begin
  if (new.stage_id is distinct from old.stage_id)
     or (coalesce(new.arquivado,false) is distinct from coalesce(old.arquivado,false)) then
    select tipo into new_tipo from public.pipeline_stages where id = new.stage_id;
    if coalesce(new.arquivado,false) or new_tipo in ('descarte','caiu') then
      update public.negocios
        set status='perdido',
            motivo_queda=coalesce(motivo_queda,'lead descartado/arquivado (sync auto)'),
            updated_at=now()
        where pipeline_lead_id = new.id and status='ativo' and fase in ('em_negociacao','contrato');
    elsif new_tipo not in ('proposta','documentacao','contrato_gerado','venda') then
      update public.negocios
        set status='arquivado',
            motivo_queda=coalesce(motivo_queda,'lead regredido — negócio fechado (sync auto)'),
            updated_at=now()
        where pipeline_lead_id = new.id and status='ativo' and fase in ('em_negociacao','contrato');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_negocio_on_lead_change on public.pipeline_leads;
create trigger trg_sync_negocio_on_lead_change
  after update of stage_id, arquivado on public.pipeline_leads
  for each row execute function public.sync_negocio_on_lead_change();
