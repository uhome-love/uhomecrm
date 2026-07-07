UPDATE public.reengajamento_dispatch_runs SET cancel_requested = true, status = 'paused', motivo_parada = 'cancelado_manual_para_novo_disparo' WHERE id = '668c273c-8a6a-4911-8b1a-eabe14ac5de7' AND status = 'running';

UPDATE public.reengajamento_dispatch_queue SET status = 'cancelled' WHERE run_id = '668c273c-8a6a-4911-8b1a-eabe14ac5de7' AND status = 'pending';