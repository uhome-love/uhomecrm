# PLANO MESTRE — EVOLUÇÃO DO HOMI E UHOME SALES

Responsável pela decisão: Lucas Sarmento / Uhome Imóveis
Sistema: Uhome Sales CRM + HOMI
Repositório: uhome-love/uhomecrm
Versão publicada de referência: 8dd9ae41e721f1846eadb9f6972cb18818f9f823
Estado: Pacote A de governança de dados voláteis publicado e validado em produção.

## OBJETIVO
Transformar o HOMI em inteligência comercial confiável e integrada ao Uhome Sales, capaz de orientar corretores e gestores sem colocar CRM, dados, Método Uhome ou operação em risco.

O HOMI deve conhecer o Método Uhome, receber produto e lead deterministicamente, separar conhecimento permanente de informação volátil, usar o CRM somente em leitura nesta fase, nunca inventar informação comercial e nunca escrever autonomamente no CRM.

## REGRAS PERMANENTES
1. O CRM é o coração da operação.
2. Método Uhome e linhas vermelhas N1/N2 nunca são relativizados.
3. Contexto de lead vem do CRM, nunca do RAG.
4. RAG serve para Método, produto, scripts, objeções e conhecimento curado.
5. Dados voláteis vêm apenas de fonte oficial vigente.
6. Sem fonte atual, orientar confirmação humana; não inventar nem prometer ação inexistente.
7. Nenhuma escrita autônoma no CRM nesta fase.
8. Código, dados e produção são separáveis e reversíveis.
9. Uma entrega pode ser ampla, mas deve ter commits e rollback por camada.
10. Deploy, migration ou escrita em dados somente com autorização de Lucas.

## ARQUITETURA DE FONTES
C1 — Método e governança: Método Uhome, SPIN, scripts, N1/N2, regras legais e políticas. Sempre presente.
C2 — Ficha permanente: nome, incorporadora, localização, conceito, tipologia geral, perfil, diferenciais e objeções validadas. Versionada e com fonte por campo.
C3 — Volátil: preço, unidade, disponibilidade, taxa, condição, parcela, entrada, prazo, fase e aprovação. Somente fonte oficial atual.
C4 — Apoio: materiais, anúncios, books, links, vídeos e imagens. Não confirmam C3 nem vencem C1/C2.
Contexto CRM — lead, corretor, etapa, tarefas e eventos carregados deterministicamente conforme tela e permissão; nunca por inferência semântica.

## ESTADO ATUAL CONFIRMADO
- A2 de continuidade conversacional publicada.
- Produto em foco selecionado explicitamente no workspace.
- Foco vive na sessão e é limpo em nova conversa, limpeza e carregamento.
- RAG geral preserva documentos com empreendimento NULL.
- HOMI_IDENTITY, N1/N2, ferramentas, perfil e multimodal ativos.
- Governança de voláteis publicada: preço não gera número antigo; Método continua pedagógico.
- Seletor possui 8 produtos governados.
- Vivid, Flow, Terrace, The Arch, Connect JW e Lake Baikal estão ativos, mas sem ficha permanente aprovada.
- Não existe hoje no banco fonte viva confiável de preço/disponibilidade para esses produtos.

# ROADMAP — QUATRO ENTREGAS ECONÔMICAS

## ENTREGA 1 — CATÁLOGO GOVERNADO DE ATIVOS E HISTÓRICOS
Objetivo: estruturar fichas permanentes versionadas dos produtos ativos e preservar históricos para atendimento de clientes existentes, sem confundir oferta vigente.

### Fatos e decisões canônicas (03/08/2026)
1. Não existem 14 produtos distintos e ativos.
2. Ativos confirmados: Casa Tua, Shift, Vivid, Flow, Terrace, The Arch, Connect JW e Lake Baikal.
3. Fora do ar, preservados somente para clientes existentes: Casa Bastian, Lake Eyre, Open Bosque e Orygem.
4. Esses quatro históricos devem aparecer em grupo secundário "Fora do ar — clientes existentes"; nunca devem ser sugeridos como oferta ativa.
5. Las Casas e Vértice são o mesmo cadastro histórico. Exibir uma única opção "Vértice – Las Casas"; "Las Casas" fica apenas como alias interno.
6. Vivid e Terrace são empreendimentos distintos. Nunca fundir, criar alias ou migrar dados entre eles.
7. O PDF institucional "Método Uhome — Fichas de Produto", criado em 01/08/2026, contém fichas de Casa Tua, Vivid, Connect João Wallig, The Arch e Lake Baikal.
8. A ficha intitulada "VIVID Terrace", da Rua Walir Zottis, 385, pertence ao Vivid, não ao Terrace.
9. Flow não consta nesse PDF.
10. Terrace deve usar somente suas próprias fontes institucionais já identificadas (site Uhome, drive/book e materiais próprios), sem herdar dados do Vivid.
11. O PDF é fonte para curadoria de conhecimento permanente, mas não é fonte viva de preço ou disponibilidade.
12. Preço, unidade, disponibilidade, entrada, parcela, taxa, condição, aprovação, fase, prazo/entrega, agenda, acesso e financiamento são C3/operacionais: não entram na ficha permanente e só podem vir de fonte oficial vigente.
13. Ainda não existe fonte viva comprovada no HOMI para preço/disponibilidade.
14. Contexto de lead continua determinístico do CRM, nunca do RAG; nenhuma escrita autônoma.

### Gate 0 — concluído
- catálogo e status acima aprovados por Lucas;
- Vivid/Terrace separados;
- Vértice/Las Casas unificado;
- nenhuma alteração de banco realizada.

### Gate 1 — curadoria em lote, antes de qualquer escrita
Campos permitidos em C2: nome canônico, incorporadora/construtora, endereço/bairro, tipo, conceito curto, tipologias/metragens gerais, perfil, diferenciais, objeções permanentes, estratégia de conversão e fonte por campo.
Campos proibidos: todos os C3 listados acima.
Ordem:
a) Casa Tua, Vivid, Connect JW, The Arch e Lake Baikal pelo PDF, removendo voláteis;
b) Terrace apenas por fontes próprias;
c) Flow pela apresentação, após validar origem/vigência;
d) Shift pela ficha legada;
e) históricos em prioridade menor, para clientes existentes.
Campo sem fonte fica vazio. Lucas recebe uma única matriz consolidada para aprovar/corrigir. Só conteúdo aprovado avança.

### Gate 2 — pacote técnico único, ainda dependente de autorização
Commit 1 schema aditivo/versionado; Commit 2 dados aprovados; Commit 3 backend lendo apenas versão validada; Commit 4 seletor com grupos ativo/histórico e alias governado; Commit 5 testes.
Requisitos: service role único escritor nesta fase, frontend sem leitura direta da tabela, snapshot antes de escrita, histórico preservado, nenhum acesso a lead, nenhuma escrita automática.

### Gate 3 — deploy controlado, autorização separada
auditoria do diff; snapshot; autorização explícita de Lucas para migration/dados; aplicação; deploy; smoke test curto sem PII; observação; rollback por camada.

### Aceitação
- cada produto aparece uma vez e no grupo correto;
- Vivid e Terrace permanecem separados;
- "Vértice – Las Casas" aparece uma vez;
- históricos nunca são oferecidos espontaneamente;
- C2 usa somente dados permanentes validados;
- preço/disponibilidade/prazo orientam confirmação oficial;
- investimento não gera garantia;
- troca de produto não vaza contexto;
- Método, SPIN, N1/N2, A2, ferramentas, perfis e Oferta Ativa permanecem intactos;
- nenhuma PII ou escrita no CRM.

## ENTREGA 2 — FONTE OFICIAL VIVA PARA C3
Objetivo: responder preço e disponibilidade atuais sem memória/material antigo.

Pré-condição: Lucas define fonte oficial — integração, planilha governada, API ou tabela operacional com responsável e vigência.

Contrato:
- somente leitura;
- atualização identificável;
- produto/unidade canônicos;
- validade/expiração;
- ausência gera confirmação humana;
- nenhuma aprovação de crédito;
- nenhuma escrita automática.

Critérios:
- resposta informa fonte/vigência;
- dado vencido não é usado;
- conflito gera bloqueio seguro;
- queda da fonte não derruba chat;
- logs sem pergunta/resposta/PII.

## ENTREGA 3 — CONTEXTO DETERMINÍSTICO DO LEAD EM LEITURA
Objetivo: orientar o corretor com base no lead aberto sem confundir pessoas e sem RAG.

Dados mínimos:
- id do lead;
- corretor responsável;
- etapa;
- empreendimento;
- última interação/próxima tarefa;
- visitas/status;
- permissões.

Regras:
- somente lead explicitamente aberto/selecionado;
- nenhuma busca por nome aproximado;
- RLS/permissões preservadas;
- PII minimizada;
- nenhuma escrita/envio automático;
- operação separada do conhecimento comercial.

Resultado: HOMI explica situação, risco, prioridade e próxima ação recomendada; corretor decide e executa.

## ENTREGA 4 — EVALS, OBSERVABILIDADE E EXPANSÃO
Evals fixos:
- Método/SPIN;
- N1;
- preço/disponibilidade/taxa/prazo;
- foco/troca;
- produto inválido;
- sem foco;
- contexto do lead;
- Oferta Ativa;
- gestor/CEO;
- ferramentas;
- A2.

Métricas sem PII:
- foco presente/válido;
- C1/C2/C3/C4 usados;
- quantidade de chunks;
- tamanho de prompt;
- latência/erro;
- ferramenta;
- recusas seguras;
- sem armazenar texto bruto.

Expansão só após estabilidade:
- demais personas;
- sugestões de tarefas;
- rascunhos;
- aprovação humana;
- escrita assistida futura em fase separada.

## MATRIZ DE TESTES
Testar:
1. sem foco;
2. cada produto;
3. foco inválido;
4. troca;
5. conversa carregada;
6. preço;
7. disponibilidade/unidade;
8. taxa/condição;
9. prazo/fase;
10. investimento/valorização;
11. SPIN/Método;
12. N1/N2;
13. Oferta Ativa;
14. ferramentas/perfis;
15. A2;
16. queda da fonte oficial;
17. permissões/LGPD;
18. rollback.
Primeiro testes locais/estáticos. IA real apenas bateria final pequena, aprovada e sem PII.

## DEPLOY E ROLLBACK
1. Preparar fora de produção.
2. Auditar diff, dados e testes.
3. Registrar SHA/snapshot.
4. Publicar fora do pico.
5. Smoke test sem PII.
6. Observar erros, latência, recusa e foco.
7. Reverter em qualquer falha crítica.

Rollback imediato se houver:
- preço/disponibilidade inventados;
- Método/N1/N2 ausente;
- produto anterior vazando;
- erro no homi-chat;
- perda de ferramentas/perfis;
- acesso indevido;
- escrita não autorizada;
- degradação séria de latência.

## POLÍTICA ECONÔMICA
1. ChatGPT/Codex diagnostica e audita via GitHub/consultas de leitura.
2. Lovable apenas na implementação final indispensável.
3. Não usar plan_mode do Lovable.
4. Um prompt completo por entrega.
5. No máximo uma correção consolidada.
6. Testes em lote.
7. Conferir saldo antes do agente pago.
8. Não usar Lovable para explicações ou relatórios repetidos.
9. Evitar screenshots quando teste estático bastar.
10. Lucas aprova três gates: conteúdo, dados e deploy.

## PRÓXIMO PASSO
Entrega 1:
1. ChatGPT inventaria fontes e monta quadro das 14 fichas sem Lovable.
2. Lucas aprova/corrige em uma revisão.
3. Só então preparar pacote técnico único de schema, dados, backend, seletor e testes.

Durante inventário/aprovação: zero migration, código, dados ou produção.

## DECISÃO
Plano mestre aprovado como direção recomendada.
Próximo gate: inventário somente de leitura das fontes dos 14 produtos e montagem das fichas para aprovação de Lucas.
