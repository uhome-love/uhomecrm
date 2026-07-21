-- 1) Remove da fila do dia primeiro (respeita FK)
DELETE FROM public.roleta_fila rf
USING public.profiles p
WHERE rf.corretor_id = p.id
  AND p.nome IN ('Andressa Madril', 'Thalia de Oliveira')
  AND rf.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

-- 2) Remove credenciamentos de hoje das duas corretoras
DELETE FROM public.roleta_credenciamentos rc
USING public.profiles p
WHERE rc.corretor_id = p.id
  AND p.nome IN ('Andressa Madril', 'Thalia de Oliveira')
  AND rc.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

-- 3) Limpa também TODOS os pendentes legados (qualquer data) — nenhum deveria existir com o fluxo novo
DELETE FROM public.roleta_fila rf
USING public.roleta_credenciamentos rc
WHERE rf.credenciamento_id = rc.id
  AND rc.status = 'pendente';

DELETE FROM public.roleta_credenciamentos WHERE status = 'pendente';