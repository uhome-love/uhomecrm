

# Explicação dos Flags e Plano de Ajuste

## Como funciona hoje

### Onde o corretor edita os flags?
Os flags são editados **dentro do modal do lead** (ao clicar no card). Existe um componente `LeadFlagControls` que aparece abaixo da barra de coaching (StageCoachBar). Dependendo da etapa, ele mostra:

- **Sem Contato**: Select "Tentativas" (0-7)
- **Contato Inicial**: Select "Impressão" (Gostou/Não gostou) + Select "Intenção" (Morar/Investir)
- **Busca**: Select "Busca pendente / Imóveis enviados"
- **Aquecimento**: Select "Prazo recontato" (30/60/90 dias)
- **Visita**: Select "Marcada / Realizada / No-show / Reagendada"
- **Pós-Visita**: Checkboxes (Feedback, Simulação, Objeções) + Select Interesse

Quando o corretor altera um desses, salva no campo `flag_status` do lead, e o badge aparece no card do Kanban (no lugar do "NOVO" ou "OA").

### Problema atual
1. O corretor não sabe que precisa abrir o lead para preencher — não há indicação visual de que falta preencher
2. O ícone de **temperatura** (🔥 quente / 🌡️ morno / ❄️ frio) ainda aparece nos cards mas vocês não usam — polui a visualização

## O que vamos fazer

### 1. Remover temperatura dos cards
Remover o ícone de temperatura (Flame/Snowflake/ThermometerSun) que aparece ao lado dos badges no `PipelineCard.tsx`. Limpar imports e lógica do `tempConfig`.

### 2. Mostrar indicador "⚠️ Preencher" quando flag está vazio
Nos cards que ainda não têm flag preenchido, em vez de mostrar "NOVO"/"OA", mostrar um badge **"⚠️ Preencher"** em amarelo para que o corretor saiba que precisa abrir e definir o status.

### 3. Melhorar visibilidade dos controles no modal
Adicionar um título claro na seção de flags dentro do modal (ex: "📋 Status da Etapa") com uma borda destacada para que o corretor identifique facilmente onde preencher.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `PipelineCard.tsx` | Remover `tempConfig`, imports de Flame/Snowflake/ThermometerSun, e o badge de temperatura. Adicionar badge "⚠️ Preencher" como fallback quando não há flags e não há originTag relevante |
| `LeadFlagControls.tsx` | Adicionar título/header visual "Status da Etapa" para ficar claro o que é |

