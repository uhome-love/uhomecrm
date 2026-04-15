

## Plano: Criar Lista "Open Bosque - Call Noturno - 15/04"

### Resumo
Criar uma lista especial na Oferta Ativa com os 866 leads elegíveis da lista "Open Bosque - Leads Não Aproveitados" para a sessão de ligações desta noite.

### Execução

1. **Criar nova lista** `oferta_ativa_listas` com nome **"Open Bosque - Call Noturno - 15/04"**, empreendimento "Open Bosque", status `ativa`, `max_tentativas: 3`, `cooldown_dias: 1`

2. **Copiar os 866 leads elegíveis** (em cooldown expirado) da lista original para a nova lista, com `status: 'na_fila'` e `tentativas_count: 0`

3. **Resultado**: Corretores acessam a Arena e selecionam "Open Bosque - Call Noturno - 15/04" para ligar imediatamente

### Detalhes Técnicos
- Inserção via SQL migration: 1 INSERT na `oferta_ativa_listas` + 1 INSERT...SELECT na `oferta_ativa_leads`
- Leads filtrados: `status = 'em_cooldown'` AND `proxima_tentativa_apos <= now()` da lista `1b43c780-ffd3-4e68-927f-2a5130b9f30b`

