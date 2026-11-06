# Lia Recupera — textos aprovados na Meta (05/11)

## O que a conferência mostrou (antes de mexer)

1. **Textos**: os 6 modelos no sistema ainda têm o texto antigo. Nomes e botões já estão iguais aos aprovados.
2. **Envio — ALERTA**: o disparador da Lia hoje só conhece os modelos antigos (`lia_reengajar_produto` e `lia_reengajar_cardapio`). Nenhum dos 6 `lia_recupera_*` está cadastrado nele. Se fossem disparados hoje, todos iriam com **só 1 informação (o nome)**:
   - A, B e C precisam de 2 (nome + empreendimento) → a Meta recusaria.
   - Lembrete precisa de 3 (nome + empreendimento + oferta) → a Meta recusaria; e ainda não existe de onde tirar a "oferta".
   - D e Final (1 = nome) → já bateriam.
   - Idioma `pt_BR` em todos: OK. Nenhum cabeçalho com imagem para eles: OK.
   Como você pediu, **não corrijo isso agora** — fica para sua decisão (abaixo). Os disparos seguem desligados, então nada é enviado errado.
3. **Aba Mensagens**: hoje não existe marcação de "aprovado/em análise" — a tela diz expressamente "não indicam aprovação da Meta". Marcar os 6 como aprovados exige criar essa indicação.

## O que vou fazer (só textos, sem banco, migrations, crons ou chave)

Arquivos alterados:
- `src/lia/recupera.ts`
  - Trocar o texto dos 6 modelos exatamente pelo aprovado (emojis, *negrito*, quebras de linha).
  - Botões sem mudança.
  - Cadência D+3: "Uma oportunidade concreta do Natal com preço real."
  - Cadência D+10: "Avisa que vai encerrar e oferece uma última olhada no Natal; sem resposta, encerra."
  - Acrescentar a cada modelo a marcação "Aprovado na Meta em 05/11".
- `src/components/lia-hub/LiaMensagensTab.tsx`
  - Mostrar o selo "Aprovado na Meta" em cada um dos 6 e ajustar a frase de aviso; mostrar as quebras de linha do texto.
- `src/lia/laboratorio.test.ts` (se algum teste conferir o texto antigo) e um teste pequeno que confere: 6 modelos, quantidade de variáveis de cada (2,2,2,1,3,1) e os 3 botões.

Validação: abrir a aba Mensagens da Lia no preview e conferir os 6 textos e selos.

## Sua decisão depois (fase separada, não incluída)

Cadastrar os 6 modelos no disparador com a quantidade certa de informações e definir de onde vem a "oferta" do lembrete (formato "2 dormitórios a partir de R$ 289 mil", sem começar por "com"/"o"). Só antes de ligar a recuperação.
