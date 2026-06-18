INSERT INTO public.user_roles (user_id, role)
VALUES ('7882d73e-ff5c-4b23-9b08-2adeadcd1800', 'diretor')
ON CONFLICT (user_id, role) DO NOTHING;