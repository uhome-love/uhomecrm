# Página "Campanha Natal 2026" (Central de materiais da campanha)

Segue o documento enviado, com uma diferença: em todo o CRM o nome passa a ser **"Campanha Natal 2026"**, e não "Central de Natal". Isso vale para o menu, o título da página e as mensagens.

## Fases (uma de cada vez, validando cada uma)
1. **Desenho primeiro:** vou desenhar o topo, a aba Empreendimentos, Scripts, Follow-ups, a versão de celular e o "Gerenciar materiais". As imagens 07 a 11 citadas no documento não vieram, então vou desenhar pelo texto. Construo só depois da sua aprovação.
2. **Textos:** guardo os textos aprovados (prêmios, regras, urna, semanas, empreendimentos, scripts, follow-ups e PDFs) exatamente como estão no documento, sem reescrever.
3. **Página e menu:** item "Campanha Natal 2026" com ícone de presente e selo dourado "Natal", logo abaixo de Minha Rotina ou do Painel. Corretor, gerente, diretoria, admin e backoffice veem o item; RH não vê. Ele some sozinho em 19/12.
   - **Topo:** fundo azul-noite com luzes, o Homi e "Faltam X dias".
   - **"Sua missão":** reaproveita os números que já existem (Minha Missão, Corrida de Natal e Placar), sem uma nova forma de contar.
   - **Abas:** Visão geral, Empreendimentos, Cards, Disparos, Instagram, Scripts, Follow-ups e PDFs, com busca.
   - **Botões:** Copiar, WhatsApp, Baixar e Compartilhar.
4. **Arquivos:** área privada de arquivos e "Gerenciar materiais", só para admin e diretor. Basta arrastar os 38 arquivos, e o nome de cada um define onde ele entra. Os arquivos e textos são apagados sozinhos em 27/12, às 3h.
5. **Atalhos:** botão "Materiais de Natal" nos quadros Minha Missão de Natal e Corrida de Natal.
6. **Conferência:** como corretor, gerente e admin, no celular, e com a data simulada em 19/12.

Nada do que já existe muda: telas, cálculos e permissões continuam iguais.

## Pontos para você confirmar
- **Datas:** o documento diz "02/11 a 18/12", mas a campanha agora conta desde 01/11. Vou mostrar "01/11 a 18/12" nas regras e nas semanas, com a S1 indo de 01 a 08/11.
- **Contas diferentes:** o documento usa "10 visitas = 1 venda" e venda média de R$ 650 mil. Hoje a Minha Missão usa 13,4 visitas e R$ 649 mil. Nos textos da página, vou mostrar exatamente o que veio no documento. Nos números de "Faltam ~N visitas", vou usar a mesma conta da Minha Missão, para os dois lugares nunca darem resultados diferentes.

## Detalhes técnicos
- **Código:** tudo novo fica em `src/natal/central/` (`conteudo.ts`, `CampanhaNatalPage.tsx`, abas, `GerenciarMateriaisSheet.tsx`, hooks). Fora da pasta, só três mudanças: registro `central-natal` no `pageRegistry.ts`, item de menu (Sidebar e menu Mais do celular) e os botões de atalho nos dois quadros.
- **Período:** `CENTRAL_INICIO`/`CENTRAL_FIM` e `isCentralNatal()` em `src/natal/config.ts`, em BRT.
- **Banco:** uma migration, fora do horário comercial, com `public.natal_materiais`. Ela traz GRANTs e RLS (todos os autenticados leem; só admin e diretor escrevem, via `has_role`), policies de `storage.objects` para o bucket privado `campanha-natal` (25 MB, jpg/png/webp/pdf; o bucket em si é criado pela ferramenta de storage) e o agendamento de `natal-central-limpeza` para 27/12, às 06:00 UTC, no mesmo padrão dos crons atuais. Nenhuma outra tabela é alterada.
- **Limpeza:** a edge function `natal-central-limpeza` só roda pelo cron a partir de 27/12, ou por admin/diretor com `{forcar:true}`. Ela apaga os arquivos em lotes de 100, depois as linhas, e desagenda o job.
- **Testes:** padrão de nome de arquivo (seção, ordem e chave), período `isCentralNatal` e quem pode gerenciar.
