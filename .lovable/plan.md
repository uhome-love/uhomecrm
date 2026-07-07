# Ativar template connectjw_julho no Reengajamento

## Objetivo
Deixar o template Meta **connectjw_julho** (aprovado, cabeçalho de imagem + botões SIM/NÃO) pronto para disparo na Central de Disparos/Reengajamento e garantir que, ao reengajar (resposta **SIM**), o lead vá para **Reengajamento → Roleta → Fila do CEO** no segmento **S2 - Investimento**, com empreendimento **Connect JW**.

## Situação atual
- A lista de templates no card de disparo (`DisparoCustomizadoCard.tsx`) é puxada direto do Meta Business. Como o `connectjw_julho` está aprovado, ele **já aparece automaticamente** para seleção — não precisa "cadastrar" nada para existir.
- Falta: (1) mapear a **imagem fixa do cabeçalho** para não colar a URL toda vez; (2) corrigir o roteamento por segmento na resposta SIM.
- Hoje a função `reativar_lead_para_fila_ceo` só tem regra para casatua/vivid/lake/atrio. Para templates não mapeados (connectjw), ela mantém o segmento antigo do lead — ou seja, **não cai em Investimento**.

## O que será feito

### 1. Imagem do cabeçalho (imagem já recebida)
- Enviar a imagem recebida (criativo "3 Quadras do Shopping Iguatemi") para o bucket `campaign-images/reengajamento/connectjw-julho.png`.
- Mapear em `DisparoCustomizadoCard.tsx`:
  - `connectjw_julho` → URL pública da imagem.
- Resultado: ao selecionar o template no card, a imagem do header é preenchida sozinha.

### 2. Roteamento SIM → Fila do CEO no segmento Investimento
- Atualizar a função `reativar_lead_para_fila_ceo` (migration) adicionando o ramo para Connect JW:
  - Se o nome do template contém `connectjw` / `connect jw` / `connect_jw` →
    - `segmento_id` = **S2 - Investimento** (`dd96ad01-7e76-40e9-8324-211166168b26`)
    - `empreendimento` = **Connect JW**
  - Mantém todo o fluxo já existente: cancela parcerias/tarefas, `reengajamento_status = respondeu_sim`, `origem = Reengajamento`, `aceite_status = pendente_distribuicao` (entra na Fila do CEO para distribuição manual), registra histórico.
- Resposta **NÃO**: sem mudança (continua inativa + arquiva, sai dos descartados).

### 3. Validação
- Confirmar via `meta-templates-list` que o `connectjw_julho` volta com `status = APPROVED` e `has_buttons = true`.
- Conferir que não está na blacklist (`blocked_templates`).
- Query de teste: após reengajar um lead, verificar que fica com `segmento_id` de Investimento, stage de novo lead e `aceite_status = pendente_distribuicao` (Fila do CEO).

## Detalhes técnicos
- Frontend: `src/components/central-nutricao/DisparoCustomizadoCard.tsx` (mapa `TEMPLATE_HEADER_IMAGES`).
- Migration: `CREATE OR REPLACE FUNCTION public.reativar_lead_para_fila_ceo(...)` com o novo ramo `v_is_connectjw` antes do `ELSE`.
- Segmento Investimento: `dd96ad01-7e76-40e9-8324-211166168b26`.
- Storage: bucket `campaign-images` (upload via ferramenta de storage).
