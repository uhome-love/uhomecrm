

## Redesign do HOMI Assistente — UX Focada em Ação Rápida

### Problema

O painel HOMI ocupa 45% da tela lateral e mostra tudo empilhado: briefing + recomendação + 4 botões + campo "o que o cliente disse" + resultado com múltiplas seções. Quando o corretor clica "Script de ligação" ou "WhatsApp apresentação", precisa esperar carregar e depois scrollar por um painel denso para encontrar o que quer copiar. Não é funcional nem visual para ação rápida.

### Solução: Dois modos de exibição

**Modo 1: Ação Direta (quando vem do StageCoachBar com prompt)**
- Não mostra briefing, recomendação nem botões de ação
- Mostra apenas: loading → resultado em cards limpos com botões grandes de Copiar/WhatsApp
- Cada card de resultado ocupa largura total com botões proeminentes (não minúsculos)
- Botão "Nova consulta" para voltar ao modo completo

**Modo 2: Exploratório (quando abre pelo botão HOMI sem prompt)**
- Briefing colapsável (começa fechado)
- Recomendação + botões de ação visíveis
- Campo "o que o cliente disse" disponível
- Resultado aparece no mesmo formato limpo

### Mudanças visuais nos cards de resultado

- Cards maiores com padding generoso
- Título da seção com emoji à esquerda
- Botões "Copiar" e "WhatsApp" como botões reais (não ghost minúsculos) — alinhados à direita com cores distintas (verde para WhatsApp, outline para copiar)
- Texto da mensagem em font-size legível (12px, não 11px)
- Seções informativas (Análise, Alerta, Próxima Ação) colapsadas por default — só expandem se o corretor quiser
- Seções acionáveis (Mensagem WhatsApp, Script) abertas e destacadas

### Mudanças no painel

- Quando em "modo ação direta", o painel pode ser mais estreito (35%) e focar 100% no resultado
- Header simplificado sem repetir "Homi AI v2 / Assistente contextual" — só "HOMI" + botão fechar
- Remover o campo "O que o cliente disse" do modo ação direta (não faz sentido quando o corretor pediu algo específico)

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/pipeline/HomiLeadAssistant.tsx` | Dois modos (ação direta vs exploratório), cards de resultado maiores com botões proeminentes, seções informativas colapsadas |
| `src/components/pipeline/PipelineLeadDetail.tsx` | Painel mais estreito no modo ação direta |

### O que NÃO muda
- Edge function / system prompt
- StageCoachBar
- Lógica de briefing e recomendação (apenas visibilidade condicional)
- Playbooks e conhecimento

