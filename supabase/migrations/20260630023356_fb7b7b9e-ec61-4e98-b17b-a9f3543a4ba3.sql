UPDATE public.cadencia_sem_contato_passos SET acao='Ligar agora', texto_app='Ligue agora para o lead — primeiro contato vale ouro.', texto_whatsapp='📞 *Ligue agora* — {nome} ({empreendimento}). Faça a primeira ligação imediatamente, lead novo tem mais chance de atender.' WHERE numero=1;

UPDATE public.cadencia_sem_contato_passos SET acao='Mandar WhatsApp', texto_app='Não atendeu? Mande um WhatsApp curto e pessoal agora.', texto_whatsapp='💬 *Mande um WhatsApp* — {nome} ({empreendimento}). Texto curto, pessoal e com seu nome. Pergunte o melhor horário para falar.' WHERE numero=2;

UPDATE public.cadencia_sem_contato_passos SET acao='Insistir no contato', texto_app='Ainda sem resposta — tente de novo por ligação OU WhatsApp.', texto_whatsapp='🔁 *Tente de novo* — {nome} ({empreendimento}). Sem retorno ainda. Volte pelo canal que achar melhor: ligação ou WhatsApp.' WHERE numero=3;

UPDATE public.cadencia_sem_contato_passos SET acao='Trazer novidade', texto_app='Reabra a conversa com uma novidade do empreendimento.', texto_whatsapp='🆕 *Traga uma novidade* — {nome} ({empreendimento}). Use um gancho: nova unidade, condição ou atualização para reabrir a conversa.' WHERE numero=4;

UPDATE public.cadencia_sem_contato_passos SET acao='Convidar para visita', texto_app='Convide para um evento ou visita ao decorado.', texto_whatsapp='🎟️ *Convide para conhecer* — {nome} ({empreendimento}). Chame para um evento ou visita ao decorado, presencial aproxima.' WHERE numero=5;

UPDATE public.cadencia_sem_contato_passos SET acao='Última tentativa de ligação', texto_app='Ligue de outro número com um motivo novo.', texto_whatsapp='📞 *Ligue de outro número* — {nome} ({empreendimento}). Às vezes o número está salvo/silenciado. Tente outro com um motivo novo.' WHERE numero=6;

UPDATE public.cadencia_sem_contato_passos SET acao='Aviso de descarte', texto_app='Último aviso: sem retorno em 24h, {nome} será descartado (reengajável).', texto_whatsapp='👋 *Mensagem de despedida* — {nome} ({empreendimento}). Envie um último contato gentil. Sem retorno em 24h, o lead sai do pipeline (volta no reengajamento).' WHERE numero=7;