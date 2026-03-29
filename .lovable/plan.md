

## Integrar Sistema Operacional de Atendimento e Conversão no HOMI (Revisado)

### O que é

A base de conhecimento completa do método UHOME de vendas — filosofia, frameworks de atendimento, motor de follow-up, sistema de ligações, anti no-show, pós-visita e contorno de objeções. Complementa as seções atuais com o método operacional real.

### Mudança

**Arquivo: `supabase/functions/homi-assistant/index.ts`**

Adicionar 5 blocos no system prompt (entre "PLAYBOOKS POR ORIGEM" e "COMO VOCÊ AJUDA", ~linha 335):

#### 1. SISTEMA OPERACIONAL DE ATENDIMENTO
- Filosofia: "Objetivo NÃO é responder leads, é CONDUZIR até VISITA"
- Framework UHOME 4 passos: Relacionamento → Diagnóstico → Oferta (máx 3) → Follow-up inteligente
- Perguntas obrigatórias de diagnóstico

#### 2. MOTOR DE FOLLOW-UP 5 DIAS (substituir seção genérica ~linha 413)
- Dia 1: Mensagem simples → Dia 2: Imagem/áudio → Dia 3: Vídeo → Dia 4: Urgência → Dia 5: Encerramento elegante
- 3 tipos: Atualização, Personalização, Prova social

#### 3. SISTEMA DE LIGAÇÕES COMPLETO (enriquecer ~linha 381)
- 2 tipos: Ligação Oferta (urgência) + Ligação Consultiva
- Estrutura: Abertura (15s) → Contexto → Proposta → Avanço
- Regra: SEMPRE sair com visita marcada OU próximo passo claro

#### 4. ANTI NO-SHOW + PÓS-VISITA
- Fluxo D0→D-2→D-1→Dia com ações específicas
- Pós-visita: follow-up no MESMO DIA
- Scripts para quem visitou vs quem não foi

#### 5. ORIENTAÇÃO DE ETAPAS CRM (adaptado ao fluxo existente)
- **NÃO define um novo fluxo** — se adapta às etapas já configuradas no pipeline do sistema
- Referência ao fluxo existente: Novos → Sem Contato → Atendimento → Possibilidade de Visita → Visita Agendada → Realizada → Proposta
- Orientação: "Sempre empurrar etapa — lead parado em Atendimento é o erro mais comum"
- A IA lê a etapa atual do lead e sugere ações para avançar dentro do fluxo que já existe

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/homi-assistant/index.ts` | 5 blocos no system prompt: Sistema Operacional, Motor Follow-up 5 dias, Sistema Ligações, Anti No-show/Pós-visita, Orientação de etapas (adaptada ao CRM existente) |

### O que NÃO muda
- Playbooks por empreendimento e por origem
- Formato de resposta obrigatório
- Regras absolutas e avançadas
- Fluxo de etapas do CRM (apenas orientação sobre como usar o que já existe)
- Nenhuma outra edge function ou componente

