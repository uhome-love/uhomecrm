# Base Única como fonte-mãe do Reengajamento — estrutura sólida

A Base Única passa a ser o público-mãe (tudo que já entrou algum dia). Em cima dela o CEO escolhe *quem quer atingir* e *quem quer excluir*, com a exclusão de "já está no pipeline ativo" explícita, visível e auditada no funil — em vez de regra escondida no banco.

## Estado atual (verificado)

- `preview_reengajamento_base` e `selecionar_reengajamento_base` são duas funções separadas com o mesmo SQL copiado. Já divergem em detalhe (janela de dedup, template) e vão divergir mais.
- A exclusão de CRM hoje é fixa: remove **todo** `pipeline_leads` não arquivado — inclui Descarte, Caiu e Ganho. Não há como o usuário escolher.
- A tela não mostra nenhum controle disso; o único par de switches é "Excluir Oferta Ativa" e "Excluir quem já recebeu disparo".
- O funil lateral renderiza chaves genéricas; o print mostra rótulos de outra fonte (Inativados definitivos / Arquivados / Cooldown 7d) com o painel de Base única aberto — ou seja, número velho de outra fonte ficou na tela.
- `base_leads.situacao_crm` existe mas é sincronizado por cron (fotografia do dia); o cruzamento correto é ao vivo por `telefone_key` (últimos 8 dígitos).

## O que muda

### 1. Uma única função de seleção (fim da duplicação)

Criar `public.base_reengajamento_candidatos(p_filtro jsonb)` que retorna as linhas já classificadas, com flags por lead:

```text
opt_out | sem_telefone | no_pipeline_ativo | descartado | ganho_cliente
arquivado | na_oferta_ativa | ja_disparado_na_janela
```

`preview_...` (contagens + amostra) e `selecionar_...` (lista final com limite/ordem) passam a ser cascas finas em cima dela. Preview e disparo nunca mais podem divergir.

Classificação canônica do cruzamento com o CRM, por `telefone_key`:
- **Pipeline ativo** = etapas Novo Lead, Sem Contato, Qualificação, Aquecimento, Visita, Pós-Visita, Em Negociação, Contrato (não arquivado).
- **Descartado / Caiu** = etapas Descarte e Caiu.
- **Ganho (cliente)** = etapa Ganho.
- **Arquivado** = `arquivado = true` em qualquer etapa.

### 2. Filtros de higiene explícitos na tela

No painel "Base única de leads", bloco **Higiene / exclusões** com switches, cada um mostrando quantos remove:

| Switch | Padrão |
| --- | --- |
| Excluir quem está no pipeline ativo | Ligado (recomendado — evita reengajar lead em atendimento) |
| Excluir quem já é cliente (Ganho) | Ligado |
| Excluir descartados / Caiu | Desligado (é justamente público de reengajamento) |
| Excluir quem está em campanha de Oferta Ativa | Ligado |
| Excluir quem já recebeu disparo (janela N dias) | Ligado, janela ajustável |
| Excluir opt-out e sem telefone | Sempre ligado, não editável |

Desligar "pipeline ativo" mostra aviso vermelho inline explicando o risco de falar com lead em atendimento.

Os filtros de público (empreendimento, formulário, campanha, safra, situação, ordem) continuam onde estão, mais `campanhas` e `situacao_crm`, que hoje a RPC aceita mas a tela não envia.

### 3. Funil fiel à fonte

O preview de `base_unica` passa a devolver o funil com chaves próprias e o `FunilLateral` renderiza o conjunto de linhas correspondente à fonte selecionada:

```text
Total na base (após filtros)      37.137
− Opt-out                          −xxx
− Sem telefone                     −xxx
− No pipeline ativo                −xxx
− Já cliente (Ganho)               −xxx
− Descartados / Caiu               −xxx   (só quando o switch está ligado)
− Em Oferta Ativa                  −xxx
− Já disparado em N dias           −xxx
= Elegíveis                        x.xxx
```

Cada linha desativada aparece cinza com "(mantidos)" em vez de sumir, para o CEO enxergar a decisão. O funil é **limpo** ao trocar de fonte e enquanto o preview roda — acaba o número fantasma do print.

### 4. Disparo usa exatamente o mesmo filtro

`reengajamento-descartados-enqueue` passa a repassar o objeto de filtro completo (incluindo os novos switches) para `selecionar_reengajamento_base`, e a guarda final do worker respeita a mesma decisão (não pode remover por "pipeline ativo" quem o usuário deliberadamente manteve). O contrato do filtro vira um tipo único compartilhado no front.

### 5. Retroalimentação

Como a base é reabastecida continuamente, o disparo grava vínculo com `base_leads` (id do lead da base na fila) para: histórico por lead, cooldown por pessoa e não só por telefone, e o retorno "SIM" continuar criando lead novo no pipeline via o fluxo já existente da Fila do CEO.

## Detalhes técnicos

- 1 migration: nova função `base_reengajamento_candidatos` + reescrita de `preview_reengajamento_base` e `selecionar_reengajamento_base` sobre ela (DDL apenas, dentro do limite de migrations/dia).
- Índices: já existem `base_leads_telefone_key_uniq`, `base_leads_emp_idx`, `base_leads_form_idx`; avaliar índice em `pipeline_leads(right(telefone_normalizado,8))` se o preview passar de ~2s.
- Front: `DisparoCustomizadoCard.tsx` (estado + envio do filtro), novo `BaseUnicaFiltros.tsx` para o bloco de higiene, `FunilLateral.tsx` (linhas por fonte + limpeza ao trocar de fonte).
- Edge: `reengajamento-audience-preview` (retorno do funil por bucket) e `reengajamento-descartados-enqueue` (passthrough do filtro). Também: erro `source inválido` passa a dizer qual source chegou, e o front deixa de manter preview antigo quando o preview falha.

## Validação antes de declarar pronto

1. SQL: conferir que `preview` e `selecionar` retornam o mesmo conjunto para o mesmo filtro.
2. Preview no navegador com "excluir pipeline ativo" ligado e desligado — a diferença tem que bater com a linha do funil.
3. Amostra de 10 leads elegíveis conferida no banco: nenhum deles em etapa ativa do pipeline.
4. Disparo em modo teste com limite baixo e conferência da fila gerada.
