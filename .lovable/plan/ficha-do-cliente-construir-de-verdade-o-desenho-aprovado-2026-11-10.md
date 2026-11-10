# Ficha do cliente — construir de verdade o desenho aprovado

## O que aconteceu
Você tem razão: a ficha ficou quase igual à antiga. Da proposta aprovada, só entraram o quadro "Atenção" e as abas. O resto ficou igual ao de antes:
- Nome, telefone e e-mail continuam grandes e ocupam o topo da coluna esquerda.
- Produto, origem, temperatura e corretor não aparecem no topo (estão escondidos no "Resumo", à direita).
- Há dois botões que fazem quase a mesma coisa ("Registrar" na próxima ação e "Registrar atividade").
- Ligar, WhatsApp e Anotar ocupam três blocos grandes.
- "Status da Etapa" continua lá embaixo.
- A data da visita (qui 12/11 14h) não aparece em destaque; só aparece a tarefa de confirmar.

## Como vai ficar (computador)

```text
+--------------------------------------------------------------------------+
| MM  Matheus Martins   [Visita · marcada v] [Quente]   Ligar WhatsApp Anotar ... X |
|     Open Bosque · Meta · entrou 24/10 · Rafaela Sandin                   |
|     (51) 98612-4093 [copiar] · assismatheus@gmail.com [copiar]           |
+------------------------------+-------------------------------------------+
| AGORA                        | Linha do tempo 8 | Tarefas 1 | Visitas 1 | Dados |
| Visita qui 12/11 · 14h       |                                           |
| Open Bosque                  |  linha do tempo limpa: ícone, frase,      |
| ---------------------------- |  quem e quando — sem caixas por item      |
| Confirmar visita             |                                           |
| amanhã · 10h                 |  Narrativa / Sistema vira filtro pequeno  |
| [ Registrar atividade ]      |  "Resumo" sai daqui (já está no topo)     |
+------------------------------+                                           |
| ATENÇÃO (só quando houver)   |                                           |
| 5 dias sem contato           |                                           |
+------------------------------+                                           |
| NEGÓCIO                      |                                           |
| valor · previsão / "ainda    |                                           |
| não há proposta"             |                                           |
+------------------------------+-------------------------------------------+
```

- **Topo único e fixo**: nome, etapa (com a situação junto, ex.: "Visita · marcada"), temperatura, produto, origem já agrupada (Meta), data de entrada, corretor e contatos em uma linha pequena com botão de copiar. Ligar / WhatsApp / Anotar / "..." viram botões compactos à direita.
- **"Status da Etapa" some como bloco**: a situação fica dentro do selo de etapa, e é possível trocá-la clicando nele.
- **Um só botão principal**: "Registrar atividade", dentro do quadro "Agora".
- **"Agora"** mostra primeiro a visita marcada (data, hora e produto) e depois a próxima tarefa.
- **Negócio** aparece sempre como um cartão pequeno (valor e previsão quando existir).
- **Linha do tempo mais leve**: sem caixa em volta de cada item e com espaçamento uniforme.
- **"Ações admin" e "Mais ações"** vão para o menu "...".

## Celular (desenho aprovado)
- Topo compacto com nome, etapa e temperatura; produto, origem e corretor em uma linha abaixo.
- "Agora" em cima, depois as abas deslizáveis.
- Barra fixa de Ligar / WhatsApp / Registrar logo acima do menu fixo de baixo, sem cobrir o menu.

## O que NÃO muda
Regras, números, etapas, tarefas, visitas, o registro de atividade e o histórico. A mudança é só na organização da tela, e todas as ações atuais continuam disponíveis.

## Validação
- Abrir fichas de clientes de teste em várias etapas (Novo Lead, Visita, Proposta, Ganho, com e sem negócio) no computador e no celular (390px).
- Clicar em cada botão (Ligar, WhatsApp, Anotar, Registrar, trocar etapa, trocar situação, "...") e sempre cancelar, sem alterar clientes reais.
- Comparar com os desenhos aprovados lado a lado antes de entregar.

## Ponto em aberto (precisa da sua decisão)
Cliente com visita marcada no futuro deve parar de aparecer como "Desatualizado" / "5 dias sem contato"? Se você não decidir agora, isso fica como está hoje.

## Detalhes técnicos
- `DrawerLeadHeader` vira o cabeçalho de largura total (acima das duas colunas) e recebe as ações compactas, os metadados (`rotuloOrigem`/`grupoOrigem`) e o seletor de etapa+situação (reaproveitando o seletor atual de flag_status de `leadHelpers.ts`).
- `PipelineLeadDetail.tsx` (1.274 linhas) será dividido: coluna "Agora" em `drawer/DrawerAgora.tsx` (une `DrawerProximaAcao` + próxima visita + o botão único) e `drawer/DrawerNegocioResumo.tsx`; o bloco "Status da Etapa" e o `DrawerActionGrid` grande saem do corpo.
- `DrawerTimeline`: tirar o cartão "Resumo" e as caixas de cada item, mantendo os dados e o filtro Narrativa/Sistema.
- Celular: o mesmo componente, com uma barra fixa respeitando a altura do menu inferior e a área segura do iPhone.
- Somente tokens do design system; nada de cores fixas.
