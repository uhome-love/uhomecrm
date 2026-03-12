UPDATE pipeline_leads SET empreendimento = 'Open Bosque', updated_at = now()
WHERE (empreendimento IS NULL OR empreendimento = '') AND observacoes LIKE '%240.000%';

UPDATE pipeline_leads SET empreendimento = 'Casa Tua', updated_at = now()
WHERE (empreendimento IS NULL OR empreendimento = '') AND observacoes LIKE '%545.000%';

UPDATE pipeline_leads SET empreendimento = 'Alto Lindoia', updated_at = now()
WHERE (empreendimento IS NULL OR empreendimento = '') AND observacoes LIKE '%379.000%';

UPDATE pipeline_leads SET empreendimento = 'Shift', updated_at = now()
WHERE (empreendimento IS NULL OR empreendimento = '') AND observacoes LIKE '%389.000%';

UPDATE pipeline_leads SET empreendimento = 'Lake Eyre', updated_at = now()
WHERE (empreendimento IS NULL OR empreendimento = '') AND observacoes LIKE '%1.995.000%';