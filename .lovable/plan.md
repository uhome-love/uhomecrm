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

## ENTREGA 1 — CATÁLOGO GOVERNADO DOS 14 PRODUTOS
Objetivo: fazer o HOMI conhecer corretamente os 14 produtos e permitir foco nos seis faltantes.

Atuais: Casa Bastian, Casa Tua, Lake Eyre, Las Casas, Open Bosque, Orygem, Shift e Vértice – Las Casas.
Novos: Vivid, Flow, Terrace, The Arch, Connect JW e Lake Baikal.

Escopo:
1. Inventariar fontes oficiais por produto.
2. Criar ficha permanente dos 6 novos.
3. Revisar e normalizar as 8 atuais.
4. Entregar a Lucas tabela única: campo, conteúdo, fonte e decisão.
5. Gravar somente conteúdo aprovado em estrutura versionada.
6. Integrar backend à ficha validada.
7. Ampliar seletor de 8 para 14.
8. Manter Oferta Ativa ampla, enviando foco somente quando governado.

Estrutura recomendada:
- tabela aditiva de ficha permanente;
- empreendimento_id canônico;
- versão;
- ficha estruturada;
- source_refs por campo;
- validada_em;
- validada_por UUID;
- status;
- created_at.
Frontend não acessa diretamente. Backend lê somente ficha validada. Snapshot antes da escrita.

Critérios:
- nomes canônicos, sem alias inventado;
- fonte por campo;
- nenhum C3 na ficha;
- novo produto só aparece após ficha validada;
- produto sem ficha vira sem foco;
- Casa Tua/Shift seguem recusando preço atual sem fonte;
- Método e A2 intactos.

Uma entrega/auditoria com commits separados:
1. schema;
2. fichas aprovadas;
3. backend;
4. seletor/contrato frontend;
5. testes.
Deploy conjunto só após todos os gates. Rollback por camada.

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
