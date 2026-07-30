# Organização do menu lateral — CEO (Fase 6)

Ajuste apenas de navegação e rótulos. Nenhuma rota, dado ou lógica de negócio muda.

## O que está acontecendo hoje (verificado no código)

- **Academia**: existe no menu de diretor, gestor e corretor — mas **não** no menu do perfil admin/CEO. Por isso você não vê. A rota `/academia` funciona normalmente.
- **Performance**: a página foi unificada dentro de `/central-relatorios` (a rota `/performance` já redireciona para lá). O menu ainda mostra o rótulo antigo "Central Relatórios", então parece que "Performance sumiu".
- **HOMI CEO**: já existe o botão do HOMI no header (`HomiHeaderButton` no AppLayout), mas o item "HOMI CEO → /homi-ceo" continua no grupo Ferramentas do menu admin.
- **Dados Anúncios** (`/dados-anuncios`): já é um hub com 2 abas — "Rastreamento & Funil" (leads por campanha/criativo/formulário até visita e venda) e "Investimento (Meta Ads)". Está no grupo "Time" e com nome que não reflete isso.

## Mudanças propostas

1. **Menu admin/CEO — grupo Ferramentas**
   - Remover o item "HOMI CEO" (rota `/homi-ceo` continua ativa para deeplink; acesso passa a ser pelo botão do header).
   - Adicionar "Academia" → `/academia`.

2. **Rótulo Performance**
   - Em todos os perfis (admin, diretor, gestor), renomear o item "Central Relatórios" para **"Performance"**, mantendo o destino `/central-relatorios`.
   - Para corretor, o item já se chama "Meus resultados" — mantém.

3. **Central de Marketing**
   - Renomear "Dados Anúncios" para **"Central de Marketing"** e movê-lo do grupo "Time" para o grupo **"Marketing"** (junto de Reengajamento) nos menus admin e diretor.
   - Rota permanece `/dados-anuncios`; título da página e do PDF passam a "Central de Marketing", com o subtítulo indicando "Leads, anúncios e investimento".
   - As duas abas continuam as mesmas (Rastreamento & Funil · Investimento Meta Ads).

## Resultado no menu do CEO

```text
Principal    Dashboard
Leads        Roleta · Pipeline · Agenda · Oferta ativa · Mutirão · Busca · Estagnados
Negócios     PDN · Vendas realizadas · Intermediação · Simulador
Time         Meu Time · Presença · Foco Corretores · Placar do Dia · Performance
Marketing    Central de Marketing · Reengajamento
Ferramentas  Imóveis · Materiais · Academia
```

## Detalhes técnicos

- Arquivos tocados: `src/components/layout/Sidebar.tsx` (config `NAV_BY_ROLE`), `src/config/pageRegistry.ts` (labels de `/central-relatorios` e `/dados-anuncios`), `src/pages/RelatorioOrigemPerformancePage.tsx` (título/cabeçalho do PDF).
- Sem migrations, sem edge functions, sem mudança de RLS ou de permissão de rota.

## Validação

Login CEO no preview: conferir menu com Academia visível, "Performance" abrindo `/central-relatorios`, ausência do item HOMI CEO (botão do header funcionando) e "Central de Marketing" abrindo `/dados-anuncios` com as duas abas.
