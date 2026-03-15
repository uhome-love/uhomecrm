
-- Step 1: Update names by extracting from email addresses
-- Convert patterns like "giovana-santos@..." to "Giovana Santos", "cristiane.weber@..." to "Cristiane Weber"
UPDATE pipeline_leads
SET nome = INITCAP(
  REPLACE(
    REPLACE(
      SPLIT_PART(email, '@', 1),
      '.', ' '
    ),
    '-', ' '
  )
)
WHERE nome = 'Lead Melnick Day'
AND email IS NOT NULL
AND aceite_status != 'descartado';

-- Step 2: For the one lead without email (phone 5551991090808), fix the phone normalization
UPDATE pipeline_leads
SET telefone_normalizado = '51991090808'
WHERE id = 'd1ff2926-29b1-40a5-966b-e907ee3172e1'
AND telefone_normalizado = '5551991090808';
