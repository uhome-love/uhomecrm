UPDATE pipeline_leads
SET corretor_id = '7a270cc1-a457-4a02-8a62-462ba5a98937',
    aceite_status = 'aceito',
    updated_at = now()
WHERE id = '24e5bc3d-e723-4885-b46b-29b3ea96e0a5'
  AND corretor_id IS NULL;