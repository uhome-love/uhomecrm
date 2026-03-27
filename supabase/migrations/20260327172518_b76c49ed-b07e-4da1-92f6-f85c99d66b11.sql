-- Add comodidades array column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS comodidades text[] DEFAULT '{}';

-- Populate from jetimob_raw CSV string
UPDATE properties
SET comodidades = array(
  SELECT trim(c)
  FROM unnest(string_to_array(jetimob_raw->>'imovel_comodidades', ',')) AS c
  WHERE trim(c) != ''
)
WHERE jetimob_raw->>'imovel_comodidades' IS NOT NULL
  AND jetimob_raw->>'imovel_comodidades' != '';

-- Create GIN index for fast array containment queries (@>)
CREATE INDEX IF NOT EXISTS idx_properties_comodidades ON properties USING GIN (comodidades);