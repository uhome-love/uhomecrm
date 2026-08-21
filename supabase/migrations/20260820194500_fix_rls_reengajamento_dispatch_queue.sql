-- Segurança (PII/LGPD): a fila de reengajamento tinha SELECT com USING(true),
-- expondo nome/telefone/email de todos os leads a QUALQUER usuário logado.
-- Restringe a leitura a admin/gestor (igual à tabela irmã reengajamento_eventos).
-- O motor roda como service_role (policy ALL própria), então não é afetado. A única
-- tela que lê (Central de Nutrição) é gated a admin e só lê contagem, nunca PII.
drop policy if exists "Authenticated users can view reengagement queue" on public.reengajamento_dispatch_queue;

create policy "admin gestor read dispatch queue"
  on public.reengajamento_dispatch_queue
  for select to authenticated
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'gestor'::app_role));
