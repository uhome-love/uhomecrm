
UPDATE roleta_credenciamentos
SET status = 'aprovado',
    aprovado_por = 'cace1f55-643c-4d70-8950-1fbff1de291f',
    aprovado_em = now()
WHERE id = 'f47457d0-37c3-4477-baf4-ffc82506d62b'
  AND status = 'pendente';
