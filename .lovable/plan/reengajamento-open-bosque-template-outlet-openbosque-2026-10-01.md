# Reengajamento Open Bosque (template `outlet_openbosque`)

## Situação hoje (verificado)
- O sistema ainda não reconhece "Open Bosque" pelo nome do template. Quem responder "Sim" entraria sem produto ou com outro produto.
- O Open Bosque existe no cadastro de empreendimentos, mas está marcado como **inativo**. Isso pode atrapalhar a Fila do CEO e o rótulo do lead.
- O template ainda não aparece aprovado (foi só criado na Meta). A Central só lista templates aprovados.
- Hoje, quando o cliente diz "Sim", a linha do tempo registra só que ele respondeu. O texto da mensagem enviada não aparece.

## O que vai ser feito
1. **Produto certo:** templates com "openbosque" / "open_bosque" passam a ser reconhecidos como **Open Bosque**, tanto na resposta quanto na Fila do CEO.
2. **Reativar o Open Bosque no cadastro** (só o campo "ativo"), para o lead reativado ficar com o produto correto. Peço sua confirmação antes.
3. **Chegar certo no corretor** (regra já em vigor, só conferida com este template):
   - cliente já com corretor ativo: continua com ele, mesma etapa, aviso no pop-up e no sininho;
   - cliente sem corretor ativo: vai para a Fila do CEO como Open Bosque.
4. **Mensagem enviada na linha do tempo:** ao responder "Sim", o lead ganha um registro com o nome do template, o texto que ele recebeu (com o nome dele) e a resposta: "Cliente respondeu: Sim, manda as informações". Vale para **todos os templates de reengajamento**, não só este.
5. **Imagem:** subir a arte enviada (otimizada, menos de 300 KB) em `campaign-images/reengajamento/outlet-openbosque.jpg` e ligar ao template na Central, para o cabeçalho vir preenchido automaticamente.

## Validação
- Quando a Meta aprovar: conferir idioma, os 2 botões, a variável {{1}} e o status. Conferir também se a imagem abre (resposta 200).
- Abrir o Disparo manual no preview e conferir se o template aparece com a arte. **Sem disparar.**
- Simular uma resposta "Sim" com um lead de teste que tenha corretor. Conferir o produto Open Bosque, o pop-up, o sininho e o texto da mensagem na linha do tempo. Apagar o teste no fim.

## Observação
A arte mostra preços. Isso é permitido no template do WhatsApp. A regra de não mostrar preço vale só para a página pública do Casa Tua.

## Detalhes técnicos
- `src/lib/reengajamentoEmpreendimento.ts`: nova regra `openbosque|open_bosque|open bosque` → "Open Bosque".
- `supabase/functions/whatsapp-webhook/index.ts`: incluir a mesma regra no mapeamento template→empreendimento_canonico_id (`6ade58aa-c6f5-4649-8546-1ba43e083c55`) e atualizar `campanha` junto. Nas inserções de `pipeline_atividades` do "Sim", adicionar à descrição o corpo do template, com {{1}} substituído pelo nome. O corpo vem do texto salvo do template (cache via Graph API `message_templates`, com fallback para só o nome do template). Também incluir a resposta clicada.
- `DisparoCustomizadoCard.tsx`: entrada em `TEMPLATE_HEADER_IMAGES`.
- Dados: `update empreendimentos_canonicos set ativo=true where id='6ade58aa-...'` (run_sql, após OK).
- Sem migration. Deploy só de `whatsapp-webhook`.
