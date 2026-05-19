## Causa raiz

O botão **Pular** em `src/components/oferta-ativa/DialingModeWithScript.tsx` (handler na linha ~1148) faz um `UPDATE` direto na tabela `oferta_ativa_leads` zerando `em_atendimento_por`/`em_atendimento_ate` e colocando `proxima_tentativa_apos = agora + 30min`.

Porém a policy de UPDATE da tabela é:

```
corretor_id = auth.uid() OR has_role(auth.uid(),'admin')
```

Para leads da fila (Casa Tua), `corretor_id` é NULL (ainda não atribuído). A corretora **não é admin** → o UPDATE bate em **0 linhas**, sem erro (RLS apenas não casa, PostgREST devolve 204). 

Em seguida o frontend chama `fetch_next_lead` (RPC `SECURITY DEFINER`). Como o UPDATE não passou, o lead permanece com:
- `em_atendimento_por = id da própria corretora` (do reserve anterior)
- `proxima_tentativa_apos` inalterado

A RPC permite servir o lead novamente se `em_atendimento_por = p_corretor_id`, e pela ordenação (menor `tentativas_count` + maior idle), **o mesmo lead volta**.

Evidência: `oa_events.lead_skipped` da Andressa Madril não aparece para hoje (último foi 15/05). Ou seja, o INSERT em `oa_events` também falha por RLS — confirma que o handler inteiro está sem permissão.

## Correção proposta

### 1) Nova função SQL `skip_oa_lead` (SECURITY DEFINER)

Substituir o UPDATE direto e o INSERT em `oa_events` por uma única RPC que roda com privilégio elevado:

```sql
CREATE OR REPLACE FUNCTION public.skip_oa_lead(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_lista_id uuid,
  p_skip_minutes integer DEFAULT 30,
  p_session_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_skip_until timestamptz := now() + (p_skip_minutes || ' minutes')::interval;
BEGIN
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;

  -- só permite skip se o lead está reservado por este corretor (ou sem dono)
  IF v_lead.em_atendimento_por IS NOT NULL
     AND v_lead.em_atendimento_por <> p_corretor_id
     AND NOT has_role(p_corretor_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_locked_by_user');
  END IF;

  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      proxima_tentativa_apos = v_skip_until
  WHERE id = p_lead_id;

  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, session_id, metadata)
  VALUES ('lead_skipped', p_corretor_id, p_lead_id, p_lista_id, p_session_id,
          jsonb_build_object('skip_until', v_skip_until, 'skip_minutes', p_skip_minutes));

  RETURN jsonb_build_object('ok', true, 'skip_until', v_skip_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_oa_lead(uuid,uuid,uuid,integer,text) TO authenticated;
```

### 2) Frontend — trocar o handler para usar a RPC

Em `src/components/oferta-ativa/DialingModeWithScript.tsx` (botão Pular, ~linha 1148), substituir o bloco `insert oa_events` + `update oferta_ativa_leads` por uma única chamada:

```ts
const { data, error } = await supabase.rpc("skip_oa_lead", {
  p_lead_id: lead.id,
  p_corretor_id: user.id,
  p_lista_id: lista.id,
  p_skip_minutes: 30,
  p_session_id: sessionId ?? null,
});
if (error || !(data as any)?.ok) {
  console.warn("[OA] skip_oa_lead falhou:", error || data);
  toast.error("Não foi possível pular este lead");
  return;
}
await fetchNext();
```

Manter `setSkipCount(prev => prev + 1)` antes e o toast de sucesso depois.

### 3) Validação

- Testar com a Andressa: clicar Pular em Casa Tua → deve aparecer **outro** lead.
- Conferir `oa_events` para `event_type='lead_skipped'` com `user_id` dela.
- Conferir que `oferta_ativa_leads.proxima_tentativa_apos` ficou ~30min no futuro no lead pulado.

## Fora de escopo

- Não mexe em RLS direto (mantém policy atual). A RPC `SECURITY DEFINER` resolve sem ampliar a permissão genérica.
- Não altera `fetch_next_lead` nem o fluxo de Campanha (que tem a mesma RPC funcionando — só o caminho do Pular estava errado).
