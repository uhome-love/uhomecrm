-- Drop the 2-argument overload of aceitar_lead that creates ambiguity
DROP FUNCTION IF EXISTS public.aceitar_lead(uuid, uuid);
