# Contrato: mostrar a intermediação que já existe e liberar a passagem

## O que encontrei no Lorenzo
- O cliente está em **Proposta**, com o negócio Open Bosque, unidade 204 T2, valor R$ 287.776.
- A intermediação do Lorenzo foi criada hoje e **já está vinculada** a ele e ao negócio.
- Para passar para Contrato, o sistema **não exige intermediação**. Só pede empreendimento, unidade, valor e a situação do contrato, e o Lorenzo tem tudo isso preenchido.
- O pop-up de Contrato, porém, só mostra o botão "Gerar intermediação", como se ainda faltasse fazer o documento. Isso confunde: parece que precisa gerar outra. Não ficou registro de erro ao salvar, então ainda não sei o que impediu o Junior de passar.

## O que muda
1. No pop-up de Contrato, quando o cliente já tem intermediação, aparece **"Intermediação pronta"** com o empreendimento, a unidade, a forma de pagamento e um botão para abrir o documento. "Gerar intermediação" só aparece quando ainda não existe nenhuma.
2. Se houver uma intermediação do cliente que não está vinculada ao negócio, aparece o botão **"Vincular a este negócio"**, para gerentes e acima.
3. Se der erro ao salvar, a mensagem fica visível junto do botão "Salvar contrato", dizendo exatamente o que falta, e o erro passa a ser registrado para eu conseguir investigar.
4. Nada muda nas regras: Contrato continua sem exigir intermediação. Ela segue obrigatória só na confirmação da venda (Ganho).

## Validação
- Reproduzir o arrasto de Proposta para Contrato com um cliente de teste que já tem intermediação. Conferir "Intermediação pronta", salvar e confirmar que o cliente passa para Contrato. Depois, apagar o teste.
- Abrir o Lorenzo como gerente, só para olhar, e cancelar, sem mover o cliente real.
- O Junior tenta de novo depois de publicado. Se travar, a mensagem nova vai mostrar o motivo.

## Detalhes técnicos
- `ContratoIntermediacao.tsx` passa a buscar em `intermediacoes`, com `status='ativa'`, por `pipeline_lead_id` ou `negocio_id`, e mostra o resumo. O vínculo usa um update restrito a gestor, com auditoria, via a função de vínculo já existente da Fase 0.5. Se ela não existir, crio uma RPC pequena, com checagem de papel.
- `JornadaNegocioForm.tsx`: mostrar `erro` perto do rodapé e registrar a falha em `ops_events`.
- Sem mudança em `registrar_jornada_negocio`, a não ser que a reprodução mostre um bloqueio no servidor.
