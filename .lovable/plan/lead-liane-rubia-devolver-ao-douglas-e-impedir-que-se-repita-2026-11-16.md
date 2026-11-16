# Lead Liane Rubia: devolver ao Douglas e impedir que se repita

## O que aconteceu (conferido no banco)
- 21h33: a Liane entrou pelo anúncio do Instagram (Open Arvoredo – Natal) e a Roleta mandou para o Douglas.
- 21h34: o Douglas aceitou em 36 segundos.
- 21h39: a mesma cliente preencheu o pop-up de saída do site. O site achou o cadastro dela pelo telefone e **regravou a lead**: tirou o corretor, voltou para "Novo Lead / aguardando distribuição" com o motivo "fila_ceo_site" e trocou as observações pelo texto do site.
- Ela não foi descartada nem estagnou. Hoje está na Fila CEO, sem corretor.
- Nenhuma parte do código do CRM grava "fila_ceo_site". Quem fez essa mudança foi o projeto do site, gravando direto no cadastro. É o único caso com esse motivo até agora.

## O que vou fazer
1. **Devolver a Liane ao Douglas**: corretor Douglas, "aceito", etapa em que ele estava, e anotação na linha do tempo: "Voltou ao Douglas — o site tirou o corretor por engano ao receber um novo contato da cliente". O texto do anúncio volta para as observações, e o do site fica salvo junto.
2. **Trava no CRM**: se um contato do site chegar para um lead que já tem corretor ativo, o CRM mantém o corretor e a etapa. Ele só junta as informações do site e avisa o corretor ("sua cliente voltou ao site"). A Fila CEO continua só para lead sem dono, descartado ou arquivado, igual à regra do reengajamento.
3. **Prompt para o projeto do site**: um texto para você enviar a ele. O site para de tirar o corretor e de mudar a etapa. Ele só envia os dados do contato e deixa o CRM decidir.
4. **Teste**: simular a mesma situação com uma lead de teste aceita por um corretor e confirmar que o corretor fica. Depois apagar a lead de teste.

## Detalhes técnicos
- Trava: gatilho BEFORE UPDATE em `pipeline_leads`. Quando `aceite_status='aceito'` e o lead tem corretor ativo, ele bloqueia a mudança `corretor_id → NULL` / `aceite_status → pendente_distribuicao` se ela vier com `motivo_pendencia='fila_ceo_site'` ou de quem não é dono (service role sem RPC autorizada). Mantém OLD.corretor_id/stage_id/aceite_status e registra em `ops_events`. As RPCs oficiais (descarte, repasse, estagnação, expiração de aceite) continuam funcionando.
- Restauração da Liane (id 57acd6aa…) via `run_sql`: corretor 70b93b6e…, `aceite_status='aceito'`, `motivo_pendencia=NULL` e anotação.
- Um teste SQL em `tests/` e a regra em `AGENTS.md`.
