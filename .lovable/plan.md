# Fase 1 — Unificar Campanha Átrio dentro da Central de Reengajamento

## Objetivo

Trazer a tela completa da Campanha Átrio para dentro da Central de Reengajamento como uma 4ª aba ("Campanhas em ondas"), sem mexer no backend nem na lógica de disparo. Mudança puramente de frontend — segura de rodar com o Lote 2 em andamento.

## O que o usuário vai ver

Hoje: 2 páginas separadas (`/central-nutricao` para disparos avulsos e `/admin/campanha-atrio` para ondas).

Depois: 1 página (`/central-nutricao`) com 4 abas:

```text
[ Novo disparo ] [ Retorno ao vivo ] [ Campanhas em ondas ] [ Configurações ]
```

- O `LiveDispatchBanner` no topo continua mostrando qualquer disparo em curso (avulso ou onda Átrio).
- O kill switch da Átrio fica visível dentro da nova aba.
- A auditoria de webhooks Meta (aba "Retorno ao vivo") já mostra as respostas da Átrio — sem mudança.
- `/admin/campanha-atrio` continua funcionando como atalho/redirect para `/central-nutricao?tab=ondas` (preserva qualquer link salvo).

## O que NÃO muda nesta fase

- Nenhuma migration.
- Nenhuma edge function (`campanha-atrio-iniciar-onda`, `campanha-atrio-disparar-onda`, `campanha-atrio-processar-resposta` ficam idênticas).
- Lógica de cooldown 20min, ondas 4/5/6 em curso, anti-spam, rate-limit — tudo intocado.
- Lote 2 rodando agora continua rodando normalmente.

## Mudanças técnicas

1. **`src/pages/CentralNutricao.tsx`**
   - Adicionar 4ª `TabsTrigger` "Campanhas em ondas" (ícone `Layers` ou `Radio`).
   - Adicionar `TabsContent value="ondas"` carregando lazy o conteúdo da Átrio.
   - Suportar `?tab=ondas` na URL para deep-link.

2. **Novo `src/components/central-nutricao/CampanhaOndasTab.tsx`**
   - Extrair o corpo de `src/pages/admin/CampanhaAtrio.tsx` (CardStatus, grid de ondas, respostas, preview de audiência) num componente reutilizável.
   - Remover o `container mx-auto p-6 max-w-6xl` externo — a Central já provê layout.
   - Manter todos os hooks `useCampanhaAtrio*` como estão.

3. **`src/pages/admin/CampanhaAtrio.tsx`**
   - Reduzir a um redirect: `<Navigate to="/central-nutricao?tab=ondas" replace />`.
   - Mantém a rota registrada para não quebrar links externos / favoritos.

4. **Sidebar / navegação (se houver entrada de "Campanha Átrio")**
   - Verificar `src/config/pageRegistry.ts` e componentes de sidebar; redirecionar o link para `/central-nutricao?tab=ondas` ou removê-lo (Central já é o ponto de entrada).

5. **Header da Central**
   - Pequeno ajuste de copy: subtítulo passa a mencionar "disparos avulsos e campanhas em ondas".

## Validação

- Abrir `/central-nutricao` → ver 4 abas, clicar em "Campanhas em ondas" → ver status do Lote 2 com ondas 4/5/6 (4 em curso, 5/6 aguardando).
- Verificar que o kill switch responde, que botão "Iniciar Onda" segue habilitado pelas mesmas regras (cooldown, flag, audiência).
- Abrir `/admin/campanha-atrio` → redireciona para a nova aba.
- `LiveDispatchBanner` continua aparecendo no topo enquanto Onda 4 envia.

## Próximas fases (não fazem parte desta entrega)

- **Fase 2**: 1 migration adicionando `campaign_type`, `wave_number`, `lote` em `reengajamento_dispatch_runs` para histórico unificado.
- **Fase 3**: opção "Campanha em ondas (Átrio)" como source no wizard de disparo avulso.
- **Fase 4** (longo prazo): unificar backend num único engine de disparo com suporte nativo a ondas.
