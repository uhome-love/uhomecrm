# UhomeSales 2.0 — Replit Bootstrap

## Objetivo
Construir a nova geração do UhomeSales de forma incremental, preservando a operação atual e usando o banco Supabase existente como fonte de verdade durante a migração.

## Regra zero
NÃO substituir, apagar ou reescrever o UhomeSales atual. Toda evolução deve ocorrer de forma isolada e reversível.

## Branch de trabalho
`uhomesales-v2-foundation`

## Fontes obrigatórias antes de implementar
Leia primeiro:
- `.lovable/plan.md`
- `docs/RAIO-X-PRODUCAO.md`
- `docs/dominios/00-indice.md`
- `docs/dominios/pipeline-funil.md`
- `docs/dominios/aquisicao-leads.md`
- `docs/dominios/visitas.md`
- `docs/dominios/homi-ia.md`
- `docs/dominios/gestao-lideranca.md`
- `docs/superpowers/specs/2026-08-08-nova-gestao-plano-completo-final.md`

Em caso de conflito, a precedência é:
1. regras atuais do banco/RPCs canônicas;
2. `2026-08-08-nova-gestao-plano-completo-final.md`;
3. documentação de domínio;
4. documentação antiga.

## Arquitetura da Fase 1
Criar uma aplicação V2 separada, inicialmente somente leitura:

```text
apps/web        React + TypeScript + Vite
apps/api        Node + Fastify + TypeScript
packages/contracts  Zod + tipos compartilhados
```

O banco permanece Supabase/Postgres atual.
Supabase Auth permanece como IdP.
RLS permanece ativa.
Storage permanece no Supabase.

## Segurança obrigatória
- Não usar `service_role` no frontend.
- Na Fase 1, preferir NÃO usar `service_role` nem na API.
- A API deve receber o JWT do usuário e criar o client Supabase com esse JWT para preservar `auth.uid()` e RLS.
- Proibir endpoints de escrita durante a Fase 1.
- Variável global: `READ_ONLY_MODE=true`.
- Não colocar secrets no Git.
- Não criar banco paralelo.
- Não alterar migrations de produção.
- Não alterar triggers, crons ou Edge Functions existentes nesta fase.

## Fonte de verdade
### Identidade
Existem dois IDs diferentes e eles nunca podem ser confundidos:
- `auth.users.id` / `profiles.user_id`: usado em `pipeline_leads.corretor_id`, `visitas.corretor_id`, Oferta Ativa e várias métricas operacionais.
- `profiles.id`: usado em `negocios.corretor_id` e alguns domínios históricos.

Crie tipos explícitos para impedir troca acidental:
```ts
type AuthUserId = string & { readonly __brand: 'AuthUserId' }
type ProfileId = string & { readonly __brand: 'ProfileId' }
```

### Hierarquia
`team_members` é a fonte única da relação gerente -> corretor.
Não inferir equipe por nome, `profiles.cargo` ou campos duplicados.

### Saúde da carteira
Fonte oficial: `rpc_carteira_saude` + `ultimo_toque_at`.
A cor do lead representa contato humano real, não tarefa/lembrete.

### Performance
Consumir primeiro as RPCs/views canônicas existentes, especialmente:
- `rpc_metricas(p_start, p_end, p_user_id, p_gerente_id, p_incluir_inativos)`
- `rpc_perf_funil(p_start, p_end, p_gerente_id, p_user_id)`
- `rpc_perf_dashboard(p_inicio, p_fim)`
- `rpc_carteira_saude(p_gerente_id, p_user_id)`
- `get_visitas_kpis(p_start, p_end, p_corretores)`
- `get_dashboard_gerente_v4_kpis(p_gestor_id, p_periodo)`
- `get_dashboard_gerente_v4_dia(p_gestor_id, p_visitas_range)`
- `v_fato_venda`
- `v_kpi_visitas`
- `v_kpi_negocios`
- `v_kpi_ligacoes`
- `v_kpi_gestao_leads`
- `v_kpi_presenca`

Nunca recalcular VGV, visitas ou performance no frontend se já existir fonte canônica no banco.

## Fase 1 — primeiro produto
Construir um `Command Center CEO` somente leitura.

### Login
- Supabase Auth atual.
- Sem cadastro novo.
- Role necessária: `admin` ou `diretor`.

### Tela principal
Exibir:
- VGV assinado no período;
- vendas no período;
- leads recebidos;
- visitas marcadas/agendadas;
- visitas realizadas;
- no-show;
- saúde da carteira;
- ranking por corretor;
- ranking por equipe;
- sinais críticos do funil;
- período selecionável.

### Experiência visual
Identidade UhomeSales:
- azul principal `#4969FF`;
- visual premium, leve e moderno;
- desktop first no CEO, responsivo;
- cards com hierarquia forte;
- tabelas densas, mas legíveis;
- sem glassmorphism excessivo;
- sem dashboards genéricos de template;
- usar Montserrat quando disponível.

## Endpoints permitidos na Fase 1
Somente GET, por exemplo:
- `GET /api/health`
- `GET /api/me`
- `GET /api/ceo/summary?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/ceo/performance?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/ceo/portfolio-health`

Nenhum POST/PATCH/PUT/DELETE operacional.

## Regras de tempo
Toda lógica de negócio deve usar `America/Sao_Paulo`.
Não usar UTC puro para fechamento de dia comercial.

## Testes mínimos antes de preview
1. usuário não autenticado recebe 401;
2. corretor não acessa Command Center CEO;
3. gestor não acessa Command Center CEO, salvo regra explícita futura;
4. admin/diretor acessa;
5. `rpc_perf_dashboard` retorna dados sem erro;
6. `rpc_carteira_saude` retorna dados sem erro;
7. `rpc_metricas` retorna dados sem erro;
8. VGV exibido bate com o UhomeSales atual para o mesmo período;
9. vendas batem;
10. visitas batem;
11. nenhum endpoint de escrita existe;
12. nenhuma `service_role` está exposta;
13. build e typecheck passam.

## Critério de aceite da Fase 1
A Fase 1 só é considerada pronta quando o Command Center V2 mostra os mesmos números canônicos do sistema atual no mesmo período e nenhum dado de produção pode ser alterado pela V2.

## Próximas fases — NÃO implementar ainda sem validação
2. War Room do gerente read-only.
3. Meu Dia do corretor + Lead 360.
4. Pipeline operacional V2.
5. Visitas.
6. Negócios/Vendas.
7. Roleta/Foco/Aceite.
8. Oferta Ativa e fila fria unificada.
9. HOMI/LIA runtime consolidado.

## Princípio de migração
Usar padrão strangler: o sistema antigo continua operando enquanto cada módulo novo é validado em paralelo. Um módulo antigo só pode ser desligado depois de equivalência funcional, testes, observabilidade, período de tráfego real e rollback definido.

## Instrução ao Replit Agent
Antes de escrever código, responda com:
1. resumo da arquitetura entendida;
2. arquivos/documentos lidos;
3. fontes canônicas que serão utilizadas;
4. plano da Fase 1;
5. riscos encontrados;
6. confirmação explícita de que nenhuma escrita em produção será criada.

Só depois implemente a Fase 1.