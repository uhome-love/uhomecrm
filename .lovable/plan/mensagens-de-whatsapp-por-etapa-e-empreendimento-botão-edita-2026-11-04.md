# Mensagens de WhatsApp por etapa e empreendimento + botão Editar funcionando

Janela afetada: a que abre ao tocar em **WhatsApp** dentro do cliente ("Escolha ou edite a mensagem").

## O que está errado hoje (conferido)
1. **Editar e Mensagem livre não deixam digitar.** A janela abre por cima da ficha do cliente, que "segura" o foco do teclado; o campo de texto aparece mas não recebe a digitação (principalmente no celular).
2. **As mensagens não seguem as etapas atuais.** A janela usa nomes antigos de etapa (novo, possível visita, visita marcada...). Por isso o selo mostra "novo_lead" cru e etapas como Aquecimento, Visita, Pós-Visita, Documentação e Contrato caem nas mensagens de "Sem Contato".
3. **Empreendimento entra só como nome.** Ex.: "Essence Canoas - Natal" aparece com o sufixo da campanha, e nenhuma mensagem usa um diferencial real do produto.

## O que vai mudar
**A. Editar e Mensagem livre funcionando** — tocar em Editar abre o texto pronto para alterar; Copiar e Abrir WhatsApp enviam o texto editado. Mensagem livre também passa a aceitar digitação.

**B. 3 mensagens por etapa atual**, com selo de etapa em português:
- Novo Lead / Sem Contato: primeiro contato, não atendeu, reativação
- Qualificação: entender momento (morar x investir), faixa de valor
- Aquecimento: novidade do produto, condição, convite leve
- Visita: confirmar visita, lembrete do dia, reagendar
- Pós-Visita: agradecimento, simulação, retomar objeção
- Documentação: lista de documentos, cobrar pendência
- Proposta: follow-up, condição, prazo
- Contrato: andamento da assinatura, próximos passos
- Etapas sem mensagem (Ganho/Descarte) mostram só Mensagem livre.

**C. Empreendimento no texto**
- Nome limpo (sem "- Natal", "v1" etc.), usando o nome oficial do cadastro.
- Quando o empreendimento tem diferencial ou "a partir de R$" cadastrado, uma das mensagens usa esse dado (ex.: Casa Tua Canoas, Open Bosque, Skyglass). Sem dado cadastrado, a mensagem fica genérica — nada inventado.
- O nome do corretor entra no lugar de "[seu nome]".

Fica igual: registro da atividade/toque ao enviar, a segunda tela (observação e próxima tarefa), e todas as outras janelas.

## Mockup antes do código
Pela regra do projeto, primeiro mando um desenho da janela (celular) com exemplos reais de 2 etapas e 2 empreendimentos para você aprovar os textos. Só depois construo.

## Validação
- No preview, em cliente de teste: abrir WhatsApp em cada etapa, tocar Editar, digitar, conferir que o texto editado vai para Copiar/Abrir (sempre cancelando, sem alterar clientes reais).
- Celular e computador.

## Detalhes técnicos
- `WhatsAppFocusFlow.tsx`: o portal fora do Dialog do `PipelineLeadDetail` sofre o focus-trap do Radix; renderizar dentro de um Radix Dialog próprio (ou `onOpenAutoFocus`/`modal` adequado) para liberar o foco do Textarea.
- Mensagens movidas para `src/lib/whatsappMensagens.ts` com chaves de `pipeline_stages.tipo` atuais (novo_lead, sem_contato, qualificacao, aquecimento, visita, pos_visita, documentacao, proposta, contrato_gerado) + teste unitário de cobertura por etapa e troca de variáveis.
- Produto: ler `empreendimento_canonico_id` → nome canônico + `empreendimento_overrides` (valor_min, diferenciais/argumentos_venda), só leitura.
- Sem mudança de banco.
