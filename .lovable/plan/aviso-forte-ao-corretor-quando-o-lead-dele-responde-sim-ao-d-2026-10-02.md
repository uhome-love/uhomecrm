# Aviso forte ao corretor quando o lead dele responde "Sim" ao disparo

## Como é hoje (conferido)
- Quando um lead que já tem corretor responde "Sim", o corretor recebe só um aviso no **sininho** do CRM, e o aviso aparece na tela se o CRM estiver aberto.
- **Nenhum push vai para o celular.** O push existe hoje só para "Visita amanhã".
- Ao clicar no aviso, o corretor cai na tela de **Aceite**, que não serve para um lead que já é dele.

## O que vou fazer
1. **Push no celular** para o corretor dono: "🔥 Fulano respondeu SIM ao disparo", com o nome do empreendimento. Toque abre o lead.
2. **Pop-up em destaque no CRM**: o aviso fica na tela até o corretor clicar, igual ao de lead novo, com botão "Abrir lead".
3. **Link certo**: o clique abre o lead direto no pipeline, não a tela de Aceite.
4. Vale para os dois caminhos em que o lead já tem corretor: o cliente que respondeu pela Base única e o cliente do pipeline ativo.
5. Nada muda em corretor, etapa, roleta ou Fila do CEO.

## Como vou validar
- Simular um "Sim" com **lead de teste** que tenha corretor de teste, e conferir:
  - o aviso no sininho;
  - o pop-up na tela;
  - o envio do push;
  - o link abrindo o lead.
- Depois, apagar os registros do teste.

## Detalhes técnicos
- `supabase/functions/whatsapp-webhook/index.ts`: nos 2 inserts de `lead_reengajado` com dono (rotas `pipeline_ativo_keep`), adicionar `dados.url = /pipeline-leads?lead=<id>` e `categoria`, que faz o pop-up exigir clique, e chamar `send-push` (user_id, title, body, url), no mesmo padrão já usado em `visita_amanha_sim`. Push é best-effort: se falhar, grava em `ops_events` e não bloqueia o resto.
- `src/hooks/useNotifications.ts`: incluir `lead_reengajado` na lista que exige clique no pop-up.
- Deploy só do `whatsapp-webhook`. Sem migration.
