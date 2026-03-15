
UPDATE pipeline_leads 
SET aceite_status = 'descartado',
    observacoes = COALESCE(observacoes, '') || ' | Descartado: lead duplicado, mantido com Junior Padilha'
WHERE id = 'ec8ea955-d320-4e72-936f-baa11e2c1217';
