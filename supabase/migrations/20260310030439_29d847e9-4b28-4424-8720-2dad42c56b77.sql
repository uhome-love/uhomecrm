-- Fix existing negocios that have auth user_id instead of profile_id as corretor_id
UPDATE negocios n
SET corretor_id = p.id
FROM profiles p
WHERE n.corretor_id::text = p.user_id::text
AND n.corretor_id IS DISTINCT FROM p.id;

-- Fix gerente_id too  
UPDATE negocios n
SET gerente_id = p.id
FROM profiles p
WHERE n.gerente_id::text = p.user_id::text
AND n.gerente_id IS DISTINCT FROM p.id;