

# Plano: Tabelas WhatsApp por Corretor

## Contexto

Já existem 4 tabelas `whatsapp_*` no schema (`whatsapp_ai_log`, `whatsapp_campaign_batches`, `whatsapp_campaign_sends`, `whatsapp_respostas`). As novas tabelas são **independentes** — nenhuma tabela existente será alterada.

O projeto já possui as funções `has_role()` e `is_lead_in_my_team()` como SECURITY DEFINER, que serão reutilizadas nas policies.

## Migration SQL proposta

```sql
-- 1. whatsapp_instancias
CREATE TABLE public.whatsapp_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aguardando_qr',
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;

-- Corretor vê apenas sua instância
CREATE POLICY "Corretor sees own instance"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Gestor vê instâncias do time
CREATE POLICY "Gestor sees team instances"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = corretor_id)
        AND gerente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'ativo'
    )
  );

-- Admin vê tudo
CREATE POLICY "Admin sees all instances"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Corretor pode inserir/atualizar sua instância
CREATE POLICY "Corretor manages own instance"
  ON public.whatsapp_instancias FOR ALL TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admin gerencia todas
CREATE POLICY "Admin manages all instances"
  ON public.whatsapp_instancias FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger auto-update updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.whatsapp_instancias
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime('updated_at');


-- 2. whatsapp_mensagens
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('sent', 'received')),
  body text NOT NULL DEFAULT '',
  media_url text,
  whatsapp_message_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

-- Corretor vê suas mensagens
CREATE POLICY "Corretor sees own messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Gestor vê mensagens do time
CREATE POLICY "Gestor sees team messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = corretor_id)
        AND gerente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'ativo'
    )
  );

-- Admin vê tudo
CREATE POLICY "Admin sees all messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Inserção: corretor insere suas próprias ou sistema (admin)
CREATE POLICY "Corretor inserts own messages"
  ON public.whatsapp_mensagens FOR INSERT TO authenticated
  WITH CHECK (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admin inserts any message"
  ON public.whatsapp_mensagens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Índices de performance
CREATE INDEX idx_whatsapp_mensagens_lead ON public.whatsapp_mensagens(lead_id);
CREATE INDEX idx_whatsapp_mensagens_corretor ON public.whatsapp_mensagens(corretor_id);
CREATE INDEX idx_whatsapp_mensagens_timestamp ON public.whatsapp_mensagens(timestamp DESC);
CREATE INDEX idx_whatsapp_instancias_corretor ON public.whatsapp_instancias(corretor_id);
```

## Notas técnicas

- **corretor_id → profiles.id** (não auth.users.id): Segue o padrão do schema existente. Nas policies, o mapeamento `profiles.user_id = auth.uid()` resolve a conversão.
- **CHECK constraint em `direction`**: Imutável, seguro — são valores fixos, não temporais.
- **moddatetime trigger**: Reutiliza a extensão já instalada no projeto para `updated_at` automático.
- **Sem realtime habilitado**: Pode ser adicionado depois se necessário para chat ao vivo.
- **Nenhuma tabela existente alterada.**

## Resumo

| Tabela | Colunas | Policies | Índices |
|--------|---------|----------|---------|
| whatsapp_instancias | 7 | 5 | 1 |
| whatsapp_mensagens | 10 | 5 | 3 |

