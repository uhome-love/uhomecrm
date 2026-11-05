# HOMI — Passo 1: base de medição

Este passo é só preparação. Não muda nenhuma tela, não muda o HOMI e não muda a Roleta, o Pipeline nem a Oferta Ativa.

Ordem aprovada para os próximos passos:
2. Dossiê do lead + memória do lead + testes de dado.
3. Missões do dia + conferência em 3 corretores.
4. Manual vivo do CRM.
5. Escolha do modelo, mensagem guardada e validador do Método.
6. Ações com prévia, uma por rodada.
7. Desenho da tela /homi, com base nas imagens do pacote.
8. Avisos pelo WhatsApp, depois que a Meta aprovar os modelos.

Registrado como item separado: a régua do amarelo da tela (`leadSaude.ts`) diverge da do banco no Aquecimento (19 a 21 dias). Essa diferença terá análise de impacto na Roleta depois e não muda neste passo.

## O que entra

### 1. Tabela `homi_ia_uso`: uma linha por chamada de IA
```sql
CREATE TABLE public.homi_ia_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,                 -- auth.users.id do corretor (sem FK)
  papel text,
  funcao text NOT NULL,         -- plano_dia | mensagem_lead | pergunta | resumo_semana | insight | chat
  modelo text NOT NULL,
  tokens_entrada int NOT NULL DEFAULT 0,
  tokens_cache int NOT NULL DEFAULT 0,
  tokens_saida int NOT NULL DEFAULT 0,
  custo_estimado_usd numeric(12,6) NOT NULL DEFAULT 0,
  lead_id uuid,
  missao text,
  latencia_ms int,
  sucesso boolean NOT NULL DEFAULT true,
  erro text
);
CREATE INDEX ON public.homi_ia_uso (user_id, created_at DESC);
CREATE INDEX ON public.homi_ia_uso (created_at DESC);
GRANT SELECT ON public.homi_ia_uso TO authenticated;
GRANT ALL ON public.homi_ia_uso TO service_role;
ALTER TABLE public.homi_ia_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uso: admin/diretor leem" ON public.homi_ia_uso FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'));
```
- Só as funções do servidor gravam nesta tabela.
- O corretor não lê esta tabela, porque o custo é informação da gestão.
- O teto diário e o alerta entram no Passo 5. Neste passo, só o valor fica guardado em `ia_config` ou `roleta_config`, ainda sem efeito.

### 2. Tabela `homi_missao_eventos`: registro de uso das missões
```sql
CREATE TABLE public.homi_missao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  missao text NOT NULL,        -- no_show_7d | confirmar_visitas | tarefas_do_dia | vermelho_amarelo | sem_contato
  evento text NOT NULL,        -- vista | aberta | lead_aberto | acao_previa | acao_confirmada | acao_cancelada | concluida
  lead_id uuid,
  acao text,
  idempotency_key text UNIQUE,
  detalhes jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ON public.homi_missao_eventos (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.homi_missao_eventos TO authenticated;
GRANT ALL ON public.homi_missao_eventos TO service_role;
ALTER TABLE public.homi_missao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos: grava o próprio" ON public.homi_missao_eventos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "eventos: lê o próprio ou gestão" ON public.homi_missao_eventos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'gestor'));
```
- Os eventos só podem ser acrescentados. Não há permissão para editar nem apagar.

### 3. `homi_saude_leads` passa a excluir leads arquivados
- Vou recriar a view igual à atual, com uma linha a mais no filtro: `AND COALESCE(l.arquivado,false) = false`.
- Nada mais muda: as colunas, a ordem e o uso de `lead_saude_status` continuam iguais.

## Quem pode ver números mudarem
- **Telas do CRM:** nenhuma. Não há uso da view no código das telas nem nas funções do servidor.
- **Função `homi_consulta`:** é a única que usa a view. Ela tem uma chave fixa e não é chamada pelo código do CRM; a chamada vem de fora (consultas externas do HOMI). Conferi hoje: **2.171 leads arquivados** entram na contagem atual e vão sair.
- **Alerta de segurança (fora do passo):** `homi_consulta` libera leitura com uma senha escrita no próprio banco. Proponho rever isso num passo próprio, sem mudar nada agora.

## Arquivos e migrations
- **Uma migration:** `homi_base_medicao` (as duas tabelas + a correção da view). Fica dentro do limite de 2 por dia, e vai ser aplicada entre 08h e 19h (Brasília).
- **Nenhum arquivo de tela ou de função do servidor muda.** A tabela de uso só passa a ser preenchida no Passo 5.
- **Registro técnico:** uma linha em `AGENTS.md` com a regra das tabelas.

## Como testar
1. Contagem antes e depois da view:
   - total;
   - quantos leads arquivados aparecem, que tem que passar de 2.171 para 0;
   - total por corretor, que tem que cair só no número de arquivados de cada um.
2. Como corretor de teste:
   - gravar 1 evento próprio tem que funcionar;
   - gravar um evento com outro `user_id` tem que falhar;
   - ler `homi_ia_uso` tem que voltar vazio.
3. Como admin, ler as duas tabelas tem que funcionar.
4. Abrir o `/homi` e o Painel CEO e confirmar que não aparece nenhum erro.

## Como desfazer
```sql
-- view: recria sem a linha do arquivado (definição atual guardada no plano)
DROP TABLE IF EXISTS public.homi_missao_eventos;
DROP TABLE IF EXISTS public.homi_ia_uso;
```
As tabelas são novas e vazias, então dá para desfazer sem perder dados.

## O que NÃO muda
- `lead_saude_status`, `get_elegibilidade_roleta`, os painéis, o Pipeline, a Roleta, a Oferta Ativa e o Reengajamento.
- O HOMI continua respondendo como hoje.
