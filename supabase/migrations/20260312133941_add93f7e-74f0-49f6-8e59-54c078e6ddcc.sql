
UPDATE empreendimento_overrides SET
  tipologias = '[
    {"dorms": 1, "area_min": 32},
    {"dorms": 2, "area_min": 45, "area_max": 48},
    {"dorms": 3, "area_min": 50}
  ]'::jsonb,
  updated_at = NOW()
WHERE codigo = '32849-UH';
