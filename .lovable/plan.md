# Lia Recupera — decisões do Lucas + cérebro completo (Fase 2)

Nada vai ao cliente até você aprovar o Laboratório (bateria de testes) e ligar a chave. Começa com 100 por dia.

## 1. Lead recuperado vai para a Fila CEO (sem Roleta)
- Quando a Lia entende que o interesse voltou, o cliente volta ao Pipeline **sem corretor**, direto na Fila CEO, para você repassar à mão.
- O corretor que descartou nunca recebe de volta (aviso na hora do repasse se você tentar).
- Cartão "Recuperado pela Lia" na Fila CEO com tudo para decidir o corretor:
  - resumo da conversa e momento do cliente (comprar agora / 3–6 meses / só pesquisando);
  - perfil de busca: região, dormitórios, faixa de preço, entrada, uso de FGTS, renda informada;
  - produto(s) de Natal que despertaram interesse;
  - histórico: quem descartou, motivo e data, empreendimento original;
  - sugestão de corretores alocados naquele produto (Foco), sem escolher por você.
- Relógios zerados e sem parceria ao voltar (regra já existente de reentrada).

## 2. Conhecimento confirmado por você (entra no cérebro)
- **Entrega:** Boa Vista pronto · Skyglass pronto · Lake Victoria pronto · Casa Tua Porto Alegre abril/2028 · Lake Eyre 2028 (≈18 meses) · Open Bosque novembro/2028 · Casa Tua Canoas novembro/2029 · Lake Baikal julho/2030.
- **Open Arvoredo — renda:** referência R$ 7.000 (2 dorms) e R$ 9.000 (3 dorms); a Lia sempre diz que depende de entrada e FGTS.
- **FGTS:** pode usar; nos Open depende de análise de cadastro com aprovação de crédito (a Lia não promete aprovação).
- **Entrada:** 10% como padrão, com proposta montada caso a caso em cada empreendimento.
- **Essence Canoas:** ficha montada a partir do e-book e da apresentação do time enviados.
- **Open Bosque volta** a ser oferecido (tem entrega definida).
- **Boa Vista, Lake Eyre e Lake Victoria** ativados no catálogo da Lia (Lake Victoria cadastrado como empreendimento novo, fora da Roleta até você ligar).

## 3. Correções que o pacote apontou (antes de ligar)
- Trava de metragem conhecer as áreas reais de todos os produtos (hoje só Canoas — bloquearia respostas).
- Fotos e plantas por produto para a Lia enviar (93 imagens do pacote).
- Prompt novo do Recupera de Natal no lugar do prompt só de Canoas, para o fluxo de recuperação.
- Corrigir mensagens prontas com informação velha (Canoas "fase final de obra", estande de setembro, tabela de agosto) e o acervo de preços antigos.
- Modelos de mensagem da Meta que começam com o nome do cliente trocados pelas versões do pacote.
- Ficha do Lake Baikal sem citar mídias inexistentes.
- Reengajamento manual atual: trocar o cardápio de agosto pelo cardápio de Natal.

## 4. Laboratório antes de ligar
- Rodar a bateria de testes do pacote (respostas de FGTS, entrada, entrega, renda, "não quero contato", troca de perfil) e você aprova as respostas.
- Botão "não quero mais contato" inativa o cliente e o tira de todos os disparos.

## Fica para você decidir depois
- Condição da Black Natal: por enquanto a Lia só diz que vai ter.
- "Casa Tua" sem cidade (~2.500 descartados) tratado como Porto Alegre — confirma?
- Repositório público do CRM: recomendo deixar privado (é no GitHub, fora do CRM).

## Detalhes técnicos
- Handoff: `liaHandoff` passa a criar/reativar o lead sem `corretor_id`, marcando origem `lia_recupera`, e chama o caminho existente de Fila CEO (sem `distribuir_lead_atomico`); bloqueio do corretor que descartou guardado no lead e checado no repasse manual.
- Contexto do cartão: anotação estruturada + `lia_estado` (perfil, momento, produtos); leitura na Fila CEO por um componente novo, só leitura.
- Fichas: atualizar `lia_produtos.ficha` com as 9 fichas do pacote + fatos acima; `ia_midias` ganha coluna `produto_slug` e recebe as mídias (upload no bucket da Lia); `travas.ts` lê `areas_reais_por_produto.json`.
- Prompt `lia-recupera-natal-v1` registrado com hash em `registro.json`; seleção pelo fluxo do lead.
- `lia_templates` e `lia_acervo` corrigidos; `src/lia/catalogoNatal.ts` e `recupera.ts` com entregas e templates novos.
- Migrations: máx. 2 no horário comercial; o resto agendado após 19h.
- Testes: regras de entrega/renda/entrada/FGTS no catálogo, handoff sem corretor e bloqueio do corretor que descartou.
