# Limpeza do menu CEO + Performance dinâmica

## Parte 1 — Limpar o menu lateral do CEO (só o menu, sem apagar código)

Edição apenas em `src/components/layout/Sidebar.tsx`, grupo `admin`. As rotas e páginas continuam acessíveis por URL (reversível e seguro). Itens removidos do menu do CEO:

- **Uso de Páginas** (`/admin/uso-paginas`)
- **Ingestão de Leads** (`/admin/ingestao`)
- **Cadastros** (`/backoffice/cadastros`) — segue disponível no menu do Backoffice, então nada quebra
- **Integração Jetimob** (`/integracao`)
- **WhatsApp Inbox** (`/whatsapp`) — removido do menu do CEO
- **Meu WhatsApp** (`/configuracoes/whatsapp`) — removido do menu do CEO

Mantém-se **Gestão WhatsApp** (`/gestor/whatsapp-dashboard`), que é o painel gerencial e não se confunde com o inbox.

Observação: nada será deletado fisicamente agora (você escolheu "só tirar do menu"). A remoção definitiva de código fica para uma "Quality Sprint" futura.

## Parte 2 — Admin → migrar para a Central de Usuários

Hoje a página **Admin** (`/admin`) concentra: gestão de papéis (roles), vínculo do `jetimob_user_id`, chave da API 360dialog (WhatsApp), reindexação do Typesense e criação de usuário. A criação/edição de usuário já vive na **Central de Usuários**.

Plano:
- Adicionar à Central de Usuários uma aba **"Ferramentas de Sistema"** (visível só para `admin`) com: gestão de papéis por usuário, edição do `jetimob_user_id`, configuração da chave 360dialog e botão de reindexação do Typesense.
- Remover o item **Admin** do menu do CEO (rota `/admin` permanece acessível por enquanto, como segurança).
- Remover **Cadastros** do menu do CEO (a edição cadastral já existe na Central de Usuários e no Backoffice).

Resultado: o CEO passa a ter um único ponto de gestão de pessoas + sistema → **Central de Usuários**.

## Parte 3 — Performance (sugestão de refatoração)

Decisão sua: **Placar do Dia continua separado** (vai para a TV, tela cheia). O que falta é uma visão **dinâmica interna ao CRM** para corretor, gerente, diretor e CEO.

Proposta: transformar a atual **Rankings** num hub **"Performance"** com 3 abas, adaptando o conteúdo ao papel de quem acessa:

```
Performance
├── Visão Geral (KPIs ao vivo + metas)
│     cards animados: VGV assinado, visitas, negócios, leads
│     barras de progresso vs meta, variação vs período anterior
├── Ranking (já existe: presenças, pipeline, visitas, negócios, oferta ativa)
│     + pódio animado top 3, badges de evolução (subiu/desceu posição)
└── Meu desempenho / Equipe (1:1)
      corretor: o próprio; gerente/diretor: a(s) equipe(s); CEO: tudo
```

Escopo por papel:
- **Corretor**: vê apenas o próprio desempenho e sua posição no ranking.
- **Gerente**: vê a própria equipe.
- **Diretora (Gabrielle)**: vê as equipes de `diretoria_equipes`.
- **CEO**: vê todas as equipes.

Elementos "dinâmicos" propostos (internos, não-TV):
- Atualização ao vivo (realtime) dos números do dia.
- Pódio animado e indicadores de subida/queda de posição.
- Comparativo vs período anterior (setas e %).
- Filtro de período já existente (hoje/semana/mês/personalizado).

Reaproveita os componentes `RankingPresencasLeads`, `RankingPipelineLeads`, `RankingVisitas`, `RankingNegocios`, `RankingOfertaAtiva` e a camada de KPIs (`useKPIs`, `metricsService`).

## Direção visual da nova Performance

- Cards com micro-animações de contagem (count-up) e barras de progresso com brilho suave.
- Pódio com destaque dourado/prata/bronze para top 3; demais em lista compacta.
- Realtime sutil (atualização sem recarregar; sem confete — confete fica no Placar/TV).
- Mantém o design system atual (Off-white/Deep Slate, highlight Indigo `#4969FF`, radius 12px). Sem novas fontes.

## Limpezas adicionais sugeridas (para você decidir depois)

- **Escala diária** (`/escala-diaria`): é o controle de presença/disponibilidade da equipe validado pelo gerente. Se a presença já é capturada de outra forma, pode virar uma aba dentro de "Meu time" em vez de item de menu próprio.
- Consolidar **Central Relatórios** e a nova **Performance** para evitar sobreposição (Central Relatórios é mais analítico/PDF; Performance é operacional/ao vivo).
- Após validar, agendar a "Quality Sprint" para deletar de fato o código de WhatsApp Inbox / Meu WhatsApp / Jetimob / Admin que ficarem órfãos.

## Notas técnicas

- Parte 1 e o ajuste de menu da Parte 2 são edições só em `Sidebar.tsx` (sem migração de banco).
- A aba "Ferramentas de Sistema" reusa as RPCs já existentes (`list_profiles_admin_with_jetimob`, gestão de `user_roles`, reindex Typesense, config 360dialog) — sem novas tabelas.
- A Performance reusa hooks/serviços existentes; nenhuma mudança de schema é necessária. Realtime via canais do Supabase nas tabelas já usadas (`negocios`, `visitas`, `pipeline_leads`).
- Tudo respeita escopo por papel via `diretoria_equipes` + `team_members`.
