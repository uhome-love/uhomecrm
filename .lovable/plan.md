# Lia Recupera — envio dos 6 modelos com as informações certas + simulação

## O que a conferência mostrou
- A chave `lia_recupera_enabled` **não existe**. O envio da Lia é controlado pela chave `lia_reengajamento_enabled`, que hoje está **ligada**. Mesmo assim nada sai, porque não há lote ativo (1 pausado, 1 concluído). Nesta fase não mexo em chave nem em lote.
- Hoje o sistema não escolhe A/B/C/D sozinho: quem arma o lote escolhe um modelo para todos. E o envio manda só o nome.
- O campo de empreendimento do cliente vem com nome de campanha ("Casa Tua Canoas v6 - Videos Novos - Tst").
- Não há etapa automática D+3/D+10. Esta fase prepara as mensagens; a cadência automática fica para outra fase.

## O que vai ser feito (sem banco, sem migration, sem disparo)

1. **Informações de cada modelo**
   - A, B, C: primeiro nome + empreendimento. D e Final: primeiro nome. Lembrete: primeiro nome + imóvel de Natal + oferta. Nenhum com cabeçalho/imagem; nada para os botões. Idioma pt_BR.
   - Nome: só o primeiro, com primeira letra maiúscula ("MARIA SILVA" → "Maria"). Sem nome válido: o cliente não entra na fila e fica marcado "sem_nome".
   - Nenhuma informação com quebra de linha ou espaços seguidos.

2. **Nome do empreendimento**
   - Converte pelo cadastro de apelidos → nome oficial. Se não achar, procura o nome oficial no começo do texto (ignora maiúsculas e acentos, pega o mais longo). "Casa Tua Alto Petrópolis" e "Casa Tua" sem cidade → "Casa Tua Porto Alegre".
   - Avulso, imóvel de terceiros ou nome que não converteu → modelo D.
   - A tabela de apelidos não é alterada.

3. **Qual modelo cada cliente recebe**
   - **C**: corretor desligado/inativado OU descartado sem nenhuma tentativa de contato (ligação, WhatsApp ou atividade).
   - **B**: motivo "sem interesse no momento".
   - **A**: os demais motivos que permitem recuperação (não atende, sem motivo, outro, sem perfil, lead antigo).
   - **D**: no lugar de A/B/C quando não há empreendimento de verdade.
   - As regras de exclusão continuam iguais (opt-out, já comprou, cliente ativo, espera de 90 dias).

4. **Imóvel do lembrete (tabela fixa, sem preço do CRM)**
   - Se for um dos 8 do Natal, manda ele mesmo (Lake Eyre, Lake Baikal e Lake Victoria contam como Golden Lake).
   - Senão, segue a sua tabela: Connect JW, Shift, Átrio, Casa Bastian, Skyline Menino Deus, The Arch, AWA → Skyglass; Orygem → Casa Tua Canoas; Terrace, Alto Lindóia, Vivid → Open Arvoredo; Flow, Isla → Open Bosque; Vértice Las Casas → Essence Canoas; High Garden Iguatemi, Grand Park Moinhos → Boa Vista Country Club; Seen Três Figueiras → Golden Lake.
   - Qualquer outro, avulso ou sem empreendimento → Open Bosque.
   - Oferta: os 8 textos fixos que você mandou, sem montar frase na hora. Depois de 18/12 o lembrete não é enviado.

5. **Botão "Simular envio" na aba Recupera** (só leitura, nada é enviado)
   - 5 clientes reais por modelo (A, B, C, D, lembrete, final), com a mensagem final completa.
   - Ao lado de cada um: modelo escolhido e por quê (motivo do descarte, empreendimento original → convertido, imóvel do lembrete e caminho).
   - Quantos clientes caem em cada caminho do lembrete (próprio, tabela, Open Bosque).
   - Lista dos nomes de empreendimento que não converteram, com a quantidade de cada um.
   - Só admin/diretoria.

6. **Testes**: quantidade e ordem das informações de cada modelo; regra do nome; A/B/C sem empreendimento → D; regra do C; conversão de nomes de campanha; escolha do imóvel do lembrete; oferta sem começar com "com" ou "o"; lembrete bloqueado depois de 18/12.

7. No fim, mando prints da simulação dos 6 modelos. O piloto só liga depois da sua revisão.

## Arquivos
- Novo `supabase/functions/_shared/liaRecuperaModelos.ts`: regras de nome, conversão do empreendimento, escolha do modelo, tabela do lembrete, ofertas, montagem das informações.
- Novo `src/lia/recuperaLembrete.ts` (ao lado de `catalogoNatal.ts`): tabela de imóveis e ofertas do lembrete, que o envio também usa.
- `supabase/functions/lia-reengajar-dispatch/index.ts`: modelos `lia_recupera_*` com as informações certas; os modelos antigos ficam iguais.
- `supabase/functions/lia-reengajar-arm/index.ts`: escolhe o modelo por cliente e marca "sem_nome" quando for o caso.
- Nova função `supabase/functions/lia-recupera-simular/index.ts`: só lê dados e devolve a simulação (confere o login e o papel).
- `src/components/lia-hub/LiaRecuperaTab.tsx` + novo `LiaRecuperaSimulacao.tsx`: botão e tela da simulação.
- Testes: `src/lia/recupera-envio.test.ts`.

## Técnico
- Contato registrado (regra do C) = existe `pipeline_atividades`, `oferta_ativa_tentativas` ou mensagem de saída no WhatsApp para o lead antes do descarte. Corretor inativo pelo cadastro de perfil.
- Para a montagem ser igual na simulação e no envio, as duas funções usam o mesmo arquivo compartilhado. Os testes do site importam esse mesmo arquivo.
- Sem migration, sem alterar `lia_reengajamento_enabled`, sem criar ou ativar lote.
