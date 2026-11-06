# HOMI Passo 2 — conferência 05/11/2026

## Estado
- Dossiê/memória construídos conforme plano aprovado com ajustes; `homi_dossie_ativo=false`.
- `homi_consulta_segredo`: zero linhas; consulta externa continua fechada. Proibição de reabrir registrada no AGENTS.md.
- Passo 1c não executado; revisão a partir de 12/11 exige nova rodada de plano. Não foi criado agendamento automático.

## Verificações realizadas
- 76 verificações autenticadas em corretor temporário (não admin), oito clientes fictícios: dados de ficha, oito atividades integrais, cinco notas recentes + fixadas, timeline inteira, mudanças, no-show, visita amanhã, objeção, Lia, disparo, negócio em parceria, Bolsão.
- Saúde comparada diretamente a `lead_saude_status` com greatest(distribuido_em,aceito_em); nenhuma régua alterada.
- Memória: confirmação obrigatória, autor/data, mesmo assunto por dois autores, idempotência, recusa de CPF pela RPC e por escrita direta, edição de outro autor sem efeito.
- Duas verificações adicionais: colisão DDD+últimos8 e associação Lia conflitante bloqueiam todas as fontes por telefone.
- Oito testes unitários de privacidade/ativação passaram.
- Integração autenticada da ferramenta: contexto recebe resumo Lia e parceria, dados pessoais do formulário excluídos. Chave simulada só no objeto do teste, nunca ligada no banco; nenhuma chamada à IA nesse ensaio.
- Preview `/homi`: proposta de memória injetada apenas no retorno do teste; Cancelar remove a prévia, Confirmar grava de verdade e leitura conferida. Imagens de prévia/confirmação inspecionadas. Não é teste de geração de resposta da IA com dossiê ativo.
- `homi-chat` publicado, ferramenta importada/executada com sessão corretor. Compilação do preview sem erros.
- Clientes, visitas, negócio, campanha, conversas/memórias fictícias e conta temporária removidos. Auditoria de criação/exclusão preservada.

## Limitações explícitas
- Não houve ativação real do dossiê nem avaliação cega das mensagens da IA: aguardam Lucas.
- Teste legado id-mapping-regression tem 3 falhas por caminhos removidos anteriormente; integração de Equipes depende de variáveis próprias e pulou 14 testes. Não se alteraram esses testes/telas fora do escopo.
- Passos 3–8 não construídos.

## Estrutura de saída
`lead`, `qualificacao`, `timeline`, `atividades_recentes`, `anotacoes`, `mudancas_etapa`, `visitas`, `tarefas`, `lia_estado`, `lia_conversas`, `whatsapp_respostas`, `oferta_ativa`, `negocios`, `parceria`, `memoria`: cada bloco tem `status` (ok/vazio/indisponível) e `dados`; fatos têm data/fonte/ciclo/autor. Últimas oito atividades e cinco anotações permanecem integrais no dossiê; projeção à IA sanitiza dados pessoais e resume prosa.

## Correções solicitadas em 05/11 — conferência 06/11 UTC
- Sanitização preserva documentação/anexo comercial, datas, objeção, próximo passo e feedback da visita real 05/11; identificadores redigidos, frases de renda/salário excluídas.
- Lacunas calculadas no banco para os quatro campos vazios e pendências comprovadas; fontes indisponíveis não viram ausência. Dois dossiês reais relidos autenticados, sem alterações nos clientes.
- Autor zero/sistemas não são outro corretor; Lia tem autor_tipo próprio.
- Timeline agrupa tentativas sem resposta por fonte/autor/ciclo/tipo/resultado; marcos mantidos. Projeção UTF-8 dos dois dossiês reais: 11.195 e 11.587 bytes. Textos essenciais preservados; envelope que não caiba mesmo após compactação falha explicitamente, não descarta marcos silenciosamente.
- Listas carregam dossiês autorizados em paralelo, até cinco fatos por lead, lacunas e orçamento conjunto. Listas grandes podem usar menos fatos para preservar lacunas.
- Todas as chamadas de chat/embeddings dos caminhos HOMI usam SDK com início durável em homi_ia_uso e finalização pelo usage real; cache/raciocínio/latência/versão/sucesso conferidos em chamadas JSON e SSE reais. Sem custo estimado inventado.
- Oito funções implantadas; contratos Deno conferidos. Preview /homi: envio pela caixa e resposta OK verificados; nenhuma ação em lead real.
- 23 testes unitários; SQL de oito regras de lacunas guardado para execução pelo dono da função (ferramenta read-only não tem permissão para helper privado). Sem ampliar acesso ao helper para testar.
- Flag permanece false; consulta externa permanece fechada. Avaliação de respostas com dossiê ativo continua aguardando Lucas.