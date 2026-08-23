-- Pós-visita padronizado: captura a objeção da visita como CAMPO REAL.
-- Antes a objeção só ia embutida no texto de observacoes, então o gerente não
-- conseguia filtrar/priorizar por objeção no cockpit, nem a LIA reengajar por motivo.
-- Mudança aditiva e reversível: coluna nullable, nenhum registro existente é afetado.
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS objecao text;

COMMENT ON COLUMN public.visitas.objecao IS
  'Objeção principal registrada no resultado da visita (padronizada: Preço, Prazo de entrega, Renda/financiamento, Decisão em família, Localização, Tamanho/planta, Quer comparar, Outra). NULL quando não houve objeção (ex: quer proposta) ou a visita não foi realizada.';
