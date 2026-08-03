# Pacote Produtos Ativos (6) + Governança de Dados Voláteis do HOMI

## 1. Resumo executivo (leigo)

Hoje o HOMI só aceita foco detalhado em 8 produtos. Lucas quer somar 6 ativos: Vivid, Flow, Terrace, The Arch, Connect JW e Lake Baikal.

Dois problemas reais impedem simplesmente "adicionar à lista":

1. Esses 6 não têm ficha comercial nenhuma. O que existe no banco é uma frase de uma linha ("Empreendimento canônico da Uhome: Vivid (ativo)"), mais materiais (drives, anúncios, links). Se entrarem no seletor agora, o HOMI vai falar sobre eles sem base — ou pior, com base em texto publicitário.
2. Onde existe ficha (Casa Tua, Shift, Lake Eyre etc.), ela carrega dado volátil antigo: faixa de preço fixa gravada em março/2026 e texto livre com preço/prazo. É exatamente daí que veio o preço que o HOMI afirmou.

O plano resolve os dois: cria uma ficha permanente mínima (sem preço) para os 6, corta a saída de dado volátil de todas as fontes permanentes, e obriga o HOMI a responder "preciso confirmar a tabela atual" quando não houver fonte atual no sistema — porque hoje **não existe** tabela de preço/disponibilidade viva no CRM para esses produtos.

## 2. Fatos confirmados (leitura desta sessão)

- HEAD = produção = `6bacd4f7fe64d460391820ff569cefb0067705ce`.
- `src/lib/empreendimentos.ts`: `HOMI_EMPREENDIMENTOS_FOCO` com 8 nomes + `resolverFocoHomi` (match exato, case-insensitive). `HomiWorkspace.tsx` e `HomiObjectionHelper.tsx` consomem essa allowlist.
- `supabase/functions/homi-chat/index.ts`: recebe `empreendimento`; aplica `FOCO_BLOQUEADO`; monta `allEmpreendimentos = formatForList(knowledge)` (**todos os produtos, sempre no prompt**) e `detalhesBlock` só do produto validado; depois RAG + materiais + `VERACIDADE_COMERCIAL_BLOCK`.
- `_shared/enterprise-knowledge.ts`: carrega `empreendimento_overrides`; `formatForAssistant` devolve `descricao_completa` inteira quando existe; senão monta campos; senão cai no `FALLBACK_KNOWLEDGE` **hardcoded no arquivo**. `formatBrief`/`formatForList` também têm `FALLBACK_BRIEF` hardcoded.
- `empreendimento_overrides` (13 registros, todos com `updated_at` de mar/mai 2026): contém `valor_min`/`valor_max` (ex.: Casa Tua 499.000–700.000; Lake Eyre 2,2M–4,8M; Orygem 880k–1,09M; Las Casas 293k–450k; Vértice 294k–338,8k) e textos longos em `descricao_completa`/`argumentos_venda`.
- Nenhum dos 6 produtos novos existe em `empreendimento_overrides`. Nenhum deles está em `FALLBACK_KNOWLEDGE`/`FALLBACK_BRIEF`.
- `homi_documents`, `category='empreendimento'`, para os 6 e para Casa Tua/Shift: conteúdo é literalmente `Empreendimento canônico da Uhome: <nome> (ativo)` (46–53 chars). Não é dossiê.
- Materiais indexados (source_type=material) existentes: Flow (apresentação, "Tabela - Pré-lançamento", vídeo), Connect JW ("Disponibilidade e Tabela", drive, anúncio, link), The Arch ("Dispo e Tabela", drive), Terrace (drive, anúncio, vídeo, link), Lake Baikal (anúncio, imagens, vídeo), Vivid (presente em `homi_documents`, itens de apoio). São **links/anúncios**, não fonte estruturada com data de vigência.
- `empreendimentos_canonicos`: os 6 existem, `ativo=true`, com IDs próprios (ex.: Vivid `8656f04a…`, Flow `0d4aa2d5…`, Terrace `3a177a9c…`, The Arch `5dc1dfd4…`, Connect JW `fa06971e…`, Lake Baikal `8654bd9d…`). Nomes canônicos batem 1:1 com os nomes usados em `homi_documents.empreendimento`.
- `materiais_links` não tem nenhuma linha ligada por `empreendimento_id` a esses canônicos (vínculo dos materiais é por outra via/nome).
- **Não foi encontrada nenhuma tabela viva de preço/tabela/disponibilidade por unidade** para esses produtos. `properties` não tem linhas casando por nome desses empreendimentos.

Hipótese (não confirmada): os materiais "Tabela"/"Disponibilidade" apontam para arquivos externos (drive/planilha), fora do banco.

## 3. Matriz dos 6 produtos

| Produto | Nome canônico | Fonte permanente | Fonte volátil oficial | Qualidade | Lacunas | Decisão |
|---|---|---|---|---|---|---|
| Vivid | Vivid | nenhuma (só linha de 1 frase) | nenhuma no banco | inexistente | localização, conceito, tipologia, perfil, diferenciais | precisa conteúdo |
| Flow | Flow | nenhuma | link "Tabela - Pré-lançamento" (externo, sem data de vigência) | inexistente | idem | precisa conteúdo |
| Terrace | Terrace | nenhuma | nenhuma estruturada | inexistente | idem | precisa conteúdo |
| The Arch | The Arch | nenhuma | link "Dispo e Tabela" (externo) | inexistente | idem | precisa conteúdo |
| Connect JW | Connect JW | nenhuma | link "Disponibilidade e Tabela" (externo) | inexistente | idem | precisa conteúdo |
| Lake Baikal | Lake Baikal | nenhuma (só anúncios/imagens) | nenhuma | inexistente | idem | precisa conteúdo |

Nenhum está "pronto"; nenhum está "bloqueado". Todos ficam liberados assim que a ficha permanente mínima (seção 8) for aprovada por Lucas.

## 4. Diagnóstico das afirmações de preço/prazo (Casa Tua e Shift)

Confirmado por leitura, sem consultar conversas:

- **Casa Tua** — origem primária: `empreendimento_overrides` (`valor_min=499000`, `valor_max=700000`, `descricao_completa` e `argumentos_venda` longos, atualizados em 14/03/2026). Esse conteúdo entra inteiro via `formatForAssistant` → `detalhesBlock`.
- **Shift** — `valor_min`/`valor_max` são NULL e `descricao_completa` existe; além disso o `FALLBACK_BRIEF["Shift"]` hardcoded entra em **todo** prompt via `formatForList`, e o `FALLBACK_KNOWLEDGE["Shift"]` entra quando a ficha do banco não cobre. Metragens/faixas do texto hardcoded viram "fato" para o modelo.
- Prazo/fase: não existe campo estruturado; qualquer afirmação de prazo veio de texto livre (descrição/argumentos/material) ou do próprio modelo.

Conclusão: o vazamento é **estrutural** — dado volátil está gravado dentro de fonte permanente e é injetado sem rótulo de data nem instrução de conferência. `VERACIDADE_COMERCIAL_BLOCK` cobre valorização/rentabilidade, não preço/prazo.

## 5. Arquitetura atual vs alvo mínimo

```text
ATUAL
foco (frontend allowlist 8) → homi-chat
  ├ allEmpreendimentos = formatForList(TODOS)      ← briefs hardcoded, sem data
  ├ detalhesBlock = formatForAssistant(foco)       ← descricao_completa + valor_min/max
  ├ RAG (buscar_conhecimento)                      ← chunks de materiais/anúncios
  └ materiaisBlock + VERACIDADE (só valorização)

ALVO
foco (allowlist única 14) → homi-chat
  ├ índice de produtos: só NOME + bairro (sem preço, sem metragem)
  ├ FICHA PERMANENTE do foco (C2): campos brancos, sem volátil, com data
  ├ RAG geral preservado (empreendimento NULL continua entrando)
  ├ materiais rotulados como C4 (apoio, nunca fonte de preço)
  └ BLOCO VOLÁTIL (C3): "sem fonte atual no sistema → não afirmar, orientar conferência"
```

## 6. Contrato de fontes C1–C4 e precedência

- **C1 — Método/regras gerais.** `HOMI_IDENTITY`, N1/N2, A2, RAG de documentos com `empreendimento IS NULL`. Nunca removido.
- **C2 — Conhecimento permanente do produto.** Localização, conceito, tipologia geral, diferenciais, perfil, objeções. Só com fonte validada e datada. **Proibido conter preço, taxa, condição, unidade, prazo/fase.**
- **C3 — Dados voláteis.** Preço, disponibilidade, unidade, taxa, condição, prazo/fase, aprovação. Só de fonte atual do sistema no momento da resposta. Hoje essa fonte **não existe** → resposta segura obrigatória (seção 7, item 8).
- **C4 — Materiais de apoio.** Drives, anúncios, imagens, links. Citáveis como material; nunca vencem C1/C2/C3 e nunca fundamentam preço/prazo.

Precedência: C3 (fonte atual) > C2 > C1 no que for factual de produto; C1 vence tudo no que for regra/comportamento. Ausência de dado vence qualquer suposição. N1 nunca relativizado.

## 7. Plano em 3 pacotes

### Pacote A — Corte do vazamento volátil (só código)
- **Objetivo/benefício:** parar imediatamente afirmação de preço/prazo a partir de fonte permanente antiga. Vale mesmo se nada mais for feito.
- **Arquivos:** `_shared/enterprise-knowledge.ts`, `homi-chat/index.ts`.
- **Mudanças:** (a) `formatForAssistant` passa a emitir ficha saneada — remove `valor_min`/`valor_max` e filtra sentenças com padrão volátil (R$, %, "a partir de", "entrega", "obra", "parcela", "taxa"), marcando `[dado volátil removido — conferir tabela atual]`; (b) `formatForList` reduzido a `• Nome — bairro` (sem brief comercial); (c) novo `GOVERNANCA_VOLATIL_BLOCK` no prompt, ao lado do de veracidade, com a resposta segura padrão; (d) cada bloco C2 recebe cabeçalho `FICHA PERMANENTE (validada em <data>) — não contém preço/condição/prazo`.
- **Dependências:** nenhuma. **Risco:** baixo; respostas ficam mais curtas e mais cautelosas.
- **Testes:** matriz da seção 10, focos Casa Tua/Shift/Lake Eyre.
- **Rollback:** `git revert` do commit. **Custo:** prompt menor (mais barato).
- **Autorização:** Lucas aprova este plano.

### Pacote B — Ficha permanente dos 6 (dados + validação humana)
- **Objetivo/benefício:** dar base real aos 6 antes de expô-los.
- **Tabelas:** `empreendimento_overrides` (upsert de 6 registros, campos C2 apenas, `valor_min`/`valor_max` deixados NULL) + 3 colunas novas de governança: `ficha_validada_em date`, `ficha_validada_por text`, `ficha_versao int`.
- **Por que overrides e não tabela nova:** é a única fonte que `formatForAssistant` já lê; criar tabela paralela duplicaria leitura, cache e risco de divergência. A alternativa aditiva (inserir dossiê em `homi_documents` e depender de RAG) foi descartada: RAG é probabilístico e não garante que a ficha do produto em foco apareça.
- **Mudanças:** migration DDL das 3 colunas; conteúdo das fichas inserido **somente após aprovação escrita** de Lucas (seção 9).
- **Dependências:** Pacote A no ar. **Risco:** médio (conteúdo humano); mitigado pela validação prévia e por `ficha_versao`.
- **Testes:** foco em cada um dos 6 → resposta cita só o que está na ficha; pergunta de preço → resposta segura.
- **Rollback:** `ficha_versao` anterior + delete dos 6 registros (não havia registro antes, rollback é limpo).
- **Autorização:** Lucas aprova conteúdo das 6 fichas, campo a campo.

### Pacote C — Exposição dos 6 no foco (só código)
- **Objetivo:** ligar os 6 no seletor e na Oferta Ativa, com contrato único.
- **Arquivos:** `src/lib/empreendimentos.ts` (allowlist 8 → 14), `HomiWorkspace.tsx` e `HomiObjectionHelper.tsx` (nenhuma mudança além de já consumirem a allowlist), `homi-chat/index.ts` (validação server-side: aceitar foco só se existir ficha com `ficha_validada_em` não nula; senão tratar como sem foco).
- **Reconhecimento de nome:** match exato case-insensitive contra `empreendimentos_canonicos.nome` (os 6 batem 1:1 com `homi_documents.empreendimento`). **Sem aliases.**
- **Dependências:** A e B concluídos. **Risco:** baixo — o gate de `ficha_validada_em` impede exposição de produto sem ficha.
- **Testes:** matriz completa. **Rollback:** reverter allowlist para 8.
- **Autorização:** Lucas libera após ver as 6 fichas em produção.

## 8. Ficha permanente mínima (campos obrigatórios)

Obrigatórios: nome canônico; incorporadora/construtora; endereço e bairro; tipo (apto/casa/studio/lote); conceito em 1–2 frases; tipologia geral (nº de dormitórios, faixa de metragem **sem preço**); perfil de cliente; 3–5 diferenciais; 2–3 objeções com resposta; estratégia de conversão; `ficha_validada_em`, `ficha_validada_por`, `ficha_versao`.

Proibidos na ficha: valor, faixa de preço, parcela, taxa, entrada, condição do mês, unidades disponíveis, prazo/fase de obra, promessa de valorização ou aprovação.

## 9. Validação humana antes da escrita

1. Rascunho das 6 fichas montado **apenas** a partir de fonte identificável (material oficial da construtora / site Uhome), com a fonte citada por campo.
2. Entrega em tabela para Lucas: campo → conteúdo → fonte.
3. Lucas aprova, corrige ou marca "não confirmar" (campo fica vazio, nunca preenchido por inferência).
4. Só então o upsert, com `ficha_validada_em` = data da aprovação e `ficha_versao` = 1.

## 10. Matriz de testes (lote)

Por produto (Vivid, Flow, Terrace, The Arch, Connect JW, Lake Baikal) e regressão (Casa Tua, Shift):
1. "me fala sobre X" → só conteúdo da ficha, sem preço.
2. "qual o preço de X" → resposta segura de conferência.
3. "tem unidade disponível / qual unidade" → resposta segura.
4. "qual a taxa / condição de pagamento" → resposta segura + N1 (não prometer aprovação/taxa).
5. "quando entrega / qual a fase da obra" → resposta segura.
6. "vale a pena investir / valorização" → sem garantia, sem transferência entre produtos.

Transversais: sem foco (não detalha produto, pergunta qual é); foco inválido/bloqueado (Átrio, Melnick Day) → tratado como sem foco; troca de produto no meio da conversa → não carrega dado do anterior; SPIN/Método (C1 intacto, cita MU-xx.x); Oferta Ativa envia o mesmo foco governado; ferramentas/perfis (buscar_imovel, gestor/CEO) inalterados; A2 (conector forte/ambíguo) inalterado.

Medição sem PII e sem custo alto: harness estático sobre o prompt montado (asserções de presença/ausência de padrões: `R$`, `%`, "entrega", "parcela") + logs por turno com tamanho do prompt e validade do foco. Nenhum texto de usuário armazenado.

## 11. Deploy e sinais de rollback

Ordem A → B → C, cada um em commit próprio, fora do horário de pico. Sinais de rollback: HOMI passa a recusar produto que tem ficha válida; some citação de MU-xx.x; erro em `homi-chat`; prompt cresce em vez de encolher; Oferta Ativa deixa de receber sugestão.

## 12. Decisões necessárias de Lucas (3)

1. Confirmar que **não existe** hoje fonte viva de preço/disponibilidade no CRM e que a resposta padrão será "preciso confirmar a tabela atual, te mando na sequência" (se existir planilha oficial fora do banco, indicar qual — muda o Pacote C).
2. Aprovar o conteúdo das 6 fichas permanentes, campo a campo, antes de qualquer escrita.
3. Aprovar o corte dos briefs comerciais hardcoded do `formatForList` (índice passa a ser só nome + bairro), aceitando respostas mais enxutas sobre produtos sem foco.

## 13. Decisão

**APROVAR PLANO PARA PREPARAR IMPLEMENTAÇÃO** — condicionado às 3 decisões acima. Nada implementado nesta sessão.

## 14. Prompt exato do primeiro pacote (não executar agora)

```text
IMPLEMENTAÇÃO CONTROLADA — PACOTE A DO HOMI (CORTE DO VAZAMENTO VOLÁTIL)
AUTORIZAÇÃO: preparar código, testes locais e commit para auditoria.
NÃO FAZER DEPLOY, MIGRATION, ALTERAÇÃO DE DADOS OU MUDANÇA DE ALLOWLIST.

Escopo — exatamente 2 arquivos:
1. supabase/functions/_shared/enterprise-knowledge.ts
   - formatForAssistant: nunca emitir valor_min/valor_max; filtrar do texto
     sentenças com padrão volátil (R$, %, "a partir de", "parcela", "entrada",
     "taxa", "entrega", "obra", "unidades", "disponív"), substituindo por
     "[dado volátil removido — conferir tabela atual]".
   - Prefixar a ficha com: "FICHA PERMANENTE (validada em <updated_at>) —
     não contém preço, condição, unidade ou prazo."
   - formatForList: passar a emitir apenas "• <nome> — <bairro ou 'Porto Alegre'>".
     Não usar FALLBACK_BRIEF como texto comercial no prompt.
2. supabase/functions/homi-chat/index.ts
   - Adicionar GOVERNANCA_VOLATIL_BLOCK após VERACIDADE_COMERCIAL_BLOCK:
     preço, disponibilidade, unidade, taxa, condição, prazo/fase e aprovação
     só podem ser afirmados se vierem de fonte atual do sistema nesta resposta;
     caso contrário responder que vai confirmar a tabela atual e seguir para a visita.
     Nunca deduzir de material, anúncio, histórico da conversa ou memória do modelo.

Preservar sem tocar: HOMI_IDENTITY, N1/N2, A2, RAG (documentos com
empreendimento NULL continuam entrando), ferramentas, perfis, FOCO_BLOQUEADO,
allowlist atual de 8 produtos.

Testes obrigatórios: tsgo; harness estático verificando que o prompt montado
para foco Casa Tua e Shift não contém "R$", faixa numérica de preço nem prazo;
que o índice de produtos não contém texto comercial; que MU-xx.x e A2 seguem intactos.
Reportar diff, resultados e SHA. Parar e aguardar auditoria.
```
