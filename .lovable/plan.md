# FASE 0 — Contrato de fontes dos 12 empreendimentos (somente leitura)

Executada em lote único. Nada foi editado, deployado ou reindexado.
Legenda: **[FATO]** verificado agora · **[HIPÓTESE]** inferência · **[REC]** recomendação · **[LUCAS]** decisão sua · **não confirmado** = sem fonte suficiente.

---

## 1. Inventário do acervo (fatos)

**Fontes existentes hoje, por prioridade** (`homi_documents` + `homi_chunks`):

| Prioridade | Tipo | Docs | Chunks | Tem campo `empreendimento` |
|---|---|---|---|---|
| 10 | documento — Método Uhome v1.0 | 1 | 107 | **não (NULL)** |
| 9 | documento — Método Casa Tua | 1 | 40 | **não (NULL)** |
| 7 | empreendimento | 69 | 69 (1 chunk cada) | sim (69) |
| 6 | academia | 20 | 22 | não (NULL) |
| 5 | documento "de apoio" (Apresentação, Manual Diário, Playbook) | 3 | 189 | não (NULL) |
| 5 | script (Meday - Consultivo) | 1 | 2 | "Sem empreendimento" |
| 4 | material | 42 | 42 | sim (42) |
| 3 | imóvel | 178 (1 em `processing`) | 177 | não |
| 0 | documento — Método v1.1 antigo | 1 | 47 | "Geral" |

Observações de fato:
- Só **um** produto tem módulo próprio de Método: **Casa Tua** (prioridade 9, 40 chunks).
- Os docs de `source_type='empreendimento'` (prioridade 7) têm **1 chunk cada** — são fichas muito curtas, não conhecimento profundo.
- Materiais cobrem apenas 10 rótulos de produto: Casa Tua, The Arch, Connect JW, Terrace, Vivid, Lake Baikal, Grand Park Moinhos, Flow, Open Arvoredo, Campanha Investidores — **nenhum** coincide com metade dos 12 overrides.
- Academia tem 1 aula de produto: "Casa Bastian e Shift — Investimento".

### Os 12 registros de `empreendimento_overrides`

| Código | Nome | Bairro | Segmento | valor_min/max | Módulo Método | Ficha p7 | Materiais | Academia |
|---|---|---|---|---|---|---|---|---|
| 39653-UH | Átrio - ABF | — | Produto Foco | — | não | sim ("Átrio") | não | não |
| 4688-UH | Casa Bastian | Menino Deus | investimento | — | não | sim | não | sim (aula investimento) |
| 52101-UH | Casa Tua | Alto Petrópolis | medio_alto | 499.000 / 700.000 | **sim (p9)** | sim | 8 materiais | não |
| 58935-UH | Lake Eyre | Cristal | — | 2.200.000 / 4.800.000 | não | sim | não | não |
| 41190-UH | Las Casas | Las Casas | medio_alto | 293.000 / 450.000 | não | não (só "Vértice Las Casas") | não | não |
| 91245-UH | Melnick Day Alto Padrão | — | — | 1.500.000 / 5.000.000 | não | só "Melnick Day" | não | não |
| 39808-UH | Melnick Day Compactos | — | — | 300.000 / 500.000 | não | idem | não | não |
| 76953-UH | Melnick Day Médio Padrão | — | — | 400.000 / 1.000.000 | não | idem | não | não |
| 32849-UH | Open Bosque | Passo Dareia | mcmv | 240.000 / 380.000 | não | sim | não (materiais são "Open Arvoredo") | não |
| 57290-UH | Orygem | Teresópolis | medio_alto | 880.000 / 1.090.000 | não | sim | não | não |
| 97325-UH | Shift | Auxiliadora | — | — | não | sim | não | sim (aula investimento) |
| LAS-CASAS-UH | Vértice - Las Casas | Ecoville ZN | — | 294.000 / 338.800 | não | sim | não | não |

**Campos perenes** em `empreendimento_overrides`: `nome`, `codigo`, `bairro`, `descricao`/`descricao_completa` (parte conceitual), `perfil_cliente`, `diferenciais`, `objecoes`, `estrategia_conversao`, `segmento_comercial`, `mapa_url`, `video_url`.
**Campos voláteis**: `valor_min`, `valor_max`, `valor_venda`, `area_privativa`, `tipologias`, `dormitorios`, `suites`, `vagas`, `status_obra`, `previsao_entrega`, e todo trecho de preço/metragem/condição embutido em `descricao_completa` e `argumentos_venda`.

**Ausências de fato:** Átrio - ABF está **vazio** (sem descrição, argumentos, diferenciais, preço, perfil). "Alto Lindóia" **não existe** em `empreendimento_overrides`, mas aparece no prompt via fallback (seção 5).

---

## 2. Matriz lado a lado — conflitos por produto

Autoridade: **A** = Método (N1/N2) · **B** = override perene (N3) · **C** = override volátil (N4) · **D** = fallback no código (não governada) · **E** = apoio (material/academia).
Nenhuma data de validade comercial está registrada em nenhuma fonte — **[FATO]**: só há `updated_at` (12/03 a 21/05/2026). Validade comercial: **não confirmado** em todos os casos.

### Casa Tua
| Afirmação | Fonte B (override) | Fonte D (código) | Conflito | Risco | Tratamento [REC] | [LUCAS] |
|---|---|---|---|---|---|---|
| Metragem | `diferenciais`: "150 a 173 m²" · `descricao_completa`: "99 m² a 176 m²" | BRIEF: "99-176m²" · FALLBACK: "99, 127, 176 m²" | **sim, interno** | alto (informação errada ao cliente) | usar valor oficial único; volátil | J-1 |
| Preço | colunas 499.000-700.000 · texto "R$ 480 mil a R$ 750 mil" | — | **sim, interno** | alto | remover do texto; volátil sob consulta | J-2 |
| "Alto potencial de valorização da região" | `argumentos_venda` | — | contradiz módulo do Método (produto de moradia) | **alto (legal/comercial)** | remover ou comprovar | **J-A (bloqueia)** |
| Finalidade | perfil = família saindo de apartamento (moradia) | idem | consistente | — | classificar oficialmente | J-B |

Nota **[FATO]**: o bloco `diferenciais` do Casa Tua ("Casas de 2 e 3 Dorms | 150 a 173 m²") é **idêntico** ao do Orygem. **[HIPÓTESE]** cópia entre registros.

### Open Bosque
| Afirmação | B (override) | D (código) | Conflito | Risco | [REC] | [LUCAS] |
|---|---|---|---|---|---|---|
| Metragem | 31 a 63 m² | BRIEF: "47-80m²" | **sim** | alto | valor oficial único | J-1 |
| Área de lazer/parque | "+22.000 m²" | BRIEF: "7.500m² de lazer" | **sim** | médio | idem | J-1 |
| Preço | 240.000-380.000 (colunas) · texto "R$232 mil a R$350 mil" | — | **sim** | alto | volátil | J-2 |
| "Potencial de valorização" / "Ideal para investimento" / "Melhor custo-benefício da região" | `argumentos_venda` | — | sem fonte | **alto** | comprovar ou remover | **J-A** |
| Renda/parcela ("a partir de R$944", "Renda a partir de R$ 3.500", "ITBI grátis") | `diferenciais` | — | volátil em campo perene | alto (condição comercial) | mover para volátil | J-2 |
| Ruído | `argumentos_venda` termina com "💡 Dica para seu CRM e IA…" | — | texto interno vazando para o prompt | médio | limpar | J-C (editorial) |

### Casa Bastian
| Afirmação | B | D | Conflito | Risco | [REC] |
|---|---|---|---|---|---|
| Metragem | diferenciais 23-27 / 32-38 m² · descrição 25-39 m² | BRIEF "14-36m²" | **sim, triplo** | alto | valor oficial único |
| Preço | colunas vazias · descrição "R$ 319 mil a R$ 599 mil" | — | preço só em texto livre | alto | volátil |
| "Alta liquidez para locação" | — | **BRIEF (código)** | sem fonte documental | **alto** | ver J-A |
| Finalidade | `segmento_comercial = investimento` | idem | consistente | — | confirmar oficialmente |

### Shift
| Afirmação | B | D | Conflito | Risco |
|---|---|---|---|---|
| Metragem | diferenciais "23 a 108 m²" · descrição "24 a 26 m²" | BRIEF "24-108m²" | **sim** | alto |
| Preço | colunas vazias · descrição "R$ 399 mil a R$ 499 mil" | — | só texto | alto |
| "gerar locação via airbnb", "exclusividade", "alto padrão" | `argumentos_venda` | BRIEF "Life on Demand" | promessa de renda sem fonte; airbnb depende de regra condominial/municipal | **alto (legal)** | **J-A** |
| Entrega "Abril/2029" | dentro de `diferenciais` (campo perene) | — | volátil em campo perene | médio |

### Lake Eyre
| Afirmação | B | D | Conflito | Risco |
|---|---|---|---|---|
| Metragem | descrição "129 a 176 m²" · `area_privativa` = 127 | BRIEF "127-326m²" | **sim, triplo** | alto |
| Preço | colunas 2.200.000-4.800.000 · texto "R$ 2 mi a R$ 4 mi" | — | **sim** | alto |
| Argumentos | `argumentos_venda` vazio | — | ausência | baixo |

### Orygem
| Afirmação | B | D | Conflito | Risco |
|---|---|---|---|---|
| Metragem | 150 e 173 m² (coerente entre campos) | BRIEF "150-173m²" | não | — |
| Preço | colunas 880.000-1.090.000 · texto "a partir de R$ 871 mil / R$ 919 mil" | — | **sim** | alto |
| Argumento | "excelente custo-benefício em relação a casas prontas" (comparação) | — | comparação sem fonte comparativa | médio | 

### Las Casas × Vértice - Las Casas (dois registros)
| Afirmação | Las Casas (41190-UH) | Vértice (LAS-CASAS-UH) | Conflito | Risco |
|---|---|---|---|---|
| Preço | 293.000-450.000 | 294.000-338.800 | **sim** (mesmo produto? não confirmado) | alto |
| Lotes | "terrenos com diferentes metragens" | "132m² a 154m²" | parcial | médio |
| "Potencial de valorização" / "Alta valorização região Ecoville" | sim | sim | sem fonte | **alto** | 
| Identidade | ambos referenciam Las Casas/Ecoville | ficha p7 só "Vértice Las Casas" | duplicidade **não confirmada** | médio | **J-D** |

### Melnick Day (3 registros)
| Afirmação | Fonte | Conflito | Risco |
|---|---|---|---|
| "Descontos de até 30% que não se repetem" | argumentos (Alto Padrão e Médio) | condição comercial de **evento datado** tratada como perene | **alto (legal — oferta)** |
| "Studios com alta demanda de locação", "Rentabilidade superior" | argumentos (Compactos) | sem fonte | **alto** |
| Evento | fallback do código diz "21/março/2026" (data passada) | conteúdo vencido ainda no prompt | **alto** |
| Natureza | é **evento**, não empreendimento (fallback afirma isso) | 3 linhas de produto para um evento | médio | **J-E** |

### Átrio - ABF
Todos os campos vazios. **não confirmado**: conceito, público, preço, metragem, finalidade. Risco: o HOMI só tem o nome + `segmento_comercial = "Produto Foco"`. **[REC]** marcar explicitamente como "sem ficha oficial — não responder sobre este produto".

---

## 3. Matriz canônica proposta (sem preencher fato incerto)

Estrutura a ser preenchida **por você**, não por mim:

| Campo | Regra | Estado hoje |
|---|---|---|
| Finalidade (moradia / investimento / ambos) | perene; só oficial | **não confirmado** para os 12. Indícios: Casa Bastian e Shift marcados `investimento`; Casa Tua e Orygem indicam moradia; Open Bosque afirma as duas coisas |
| Público | perene | existe texto em 10 de 12; Átrio e Las Casas ausentes |
| Conceito | perene | existe em 11 de 12 |
| Localização | perene | bairro ausente em Átrio e nos 3 Melnick Day |
| Diferenciais estruturais | perene; **sem** preço, entrega, renda ou ITBI | hoje contaminados (Open Bosque, Shift) |
| Preço | **volátil — consultar fonte oficial no momento** | divergente em 6 produtos |
| Metragem | **volátil — consultar fonte oficial no momento** | divergente em 5 produtos |
| Disponibilidade | **volátil — consultar fonte oficial no momento** | inexistente em `empreendimento_overrides` |
| Condições (entrada, FGTS, desconto, ITBI) | **volátil — consultar fonte oficial no momento** | hoje em campo perene |
| Valorização / demanda / liquidez / escassez / comparação | **proibido sem fonte documental citável** | hoje afirmado em Casa Tua, Open Bosque, Las Casas, Vértice, Shift, Melnick Day Compactos, Casa Bastian (via código) |

---

## 4. Contrato global de fontes

**Precedência determinística** — parar no primeiro critério que decide:
1. Módulo de Método do produto (N1/N2 no escopo dele) prevalece sobre o Método geral **naquilo que é específico do produto**. Não enfraquece N1/N2 porque é a mesma autoridade aplicada ao caso.
2. Método (geral ou de produto) vence qualquer apoio em afirmação de fato ou comportamento.
3. Override perene (N3) decide conceito, público, localização e diferencial estrutural.
4. Dado volátil (N4) só pode ser afirmado se consultado **naquele turno** em fonte oficial, e sempre com aviso de confirmação. Memória e RAG **nunca** valem como "atual".
5. Contexto de lead: exclusivamente determinístico, via ferramentas do CRM. Nunca via RAG.
6. Empate remanescente → "não confirmado" + indicar onde confirmar. Nunca escolher a versão mais favorável à venda.
7. Fonte ausente → recusa educada e encaminhamento. Nunca inferência.

**Uso permitido / proibido:** Método → comportamento e argumentação; nunca preço/disponibilidade. Override perene → conceito e diferencial; nunca valorização/liquidez. Override volátil → só sob consulta. Academia → técnica; nunca fato de mercado. Material/anúncio → indicar ao corretor; nunca fonte de fato. Script → estrutura; nunca dado. Imóveis → busca; nunca argumento de mercado. Fallback do código → ver seção 5.

---

## 5. FALLBACK_KNOWLEDGE — condição exata de ativação (fato de código)

**[FATO]** Existem **três** estruturas fixas no código (`_shared/enterprise-knowledge.ts`): `FALLBACK_KNOWLEDGE` (9 produtos: Casa Tua, Open Bosque, Melnick Day, Alto Lindóia, Orygem, Casa Bastian, Shift, Lake Eyre, Las Casas), `FALLBACK_BRIEF` (9 nomes) e `FALLBACK_HASHTAGS`.

**[FATO] Condição exata:**
- `formatForAssistant(records, nome)` retorna `FALLBACK_KNOWLEDGE[nome]` **somente quando não encontra registro no banco** com aquele nome/código (linha 254). No `homi-chat`, o bloco detalhado itera **apenas registros do banco**, então esse caminho **raramente é acionado ali** — mas é acionado em qualquer chamador que peça um nome que não existe no banco.
- `formatForList(records)` **sempre** mescla as chaves de `FALLBACK_BRIEF` ao conjunto de nomes (linha ~287). Ou seja, **em toda requisição** a lista-resumo inclui os 9 nomes fixos, mesmo os que não existem no banco. `formatBrief` cai em `FALLBACK_BRIEF[nome]` quando o registro não tem descrição/bairro/dormitórios/diferenciais.
- Conclusão honesta: **não é correto dizer que o texto detalhado do fallback entra sempre**; é correto dizer que **os nomes e os textos curtos do `FALLBACK_BRIEF` entram na lista em toda requisição** — inclusive "Alto Lindóia", que não existe nos 12 overrides.

**Conflitos do fallback contra o banco** (fatos, já detalhados na seção 2): Open Bosque 47-80m² × 31-63m² e 7.500m² × 22.000m²; Casa Bastian 14-36m² × 23-39m²; Lake Eyre 127-326m² × 129-176m²; Melnick Day com data de evento passada (março/2026).

**Riscos:** afirmações não governadas ("alta liquidez para locação", "urgência real", "melhor custo-benefício") entram no prompt sem passar por banco, sem data e sem dono; e um produto inexistente no cadastro (Alto Lindóia) é apresentado como oferta.

**[REC]** Não alterar nada agora. Tratar como decisão isolada. **[LUCAS] J-F**: manter / neutralizar (tirar afirmação de mercado e data) / remover assumindo degradação explícita.

---

## 6. Verificação técnica obrigatória — resultado (crítico)

**[FATO] Condição WHERE exata da RPC** `public.buscar_conhecimento`:
```sql
AND (filter_empreendimento IS NULL OR hd.empreendimento = filter_empreendimento)
AND (filter_source_types IS NULL OR hd.source_type = ANY(filter_source_types))
ORDER BY hd.priority DESC, similarity DESC
LIMIT match_count
```

**[FATO] Consequência decisiva:** filtrar por um produto **exclui** todos os documentos com `empreendimento IS NULL` — o que inclui **o Método Uhome v1.0 (107 chunks), o módulo Método Casa Tua (40 chunks), as 20 aulas da Academia e os 3 documentos de apoio**. Ou seja, usar `filter_empreendimento` hoje derruba justamente a camada N1/N2. **A Alternativa A, como estava escrita no plano anterior, é tecnicamente insegura e precisa ser ajustada.**

**[FATO] De onde o `homi-chat` obtém o produto em foco hoje:** apenas do campo `empreendimento` do corpo da requisição (linha 33), e ele é usado **somente** na busca de materiais (linha 220). Na chamada RAG principal é passado `empreendimento: null` (linha 94).

**[FATO] Quem envia esse campo:** `HomiObjectionHelper.tsx` envia (produto selecionado na Oferta Ativa). `HomiChat.tsx` e `HomiContext.tsx` **não** enviam — nenhuma referência a `empreendimento` nesses arquivos.

**Troca de assunto e ausência de produto:** no chat geral não há **nenhum** mecanismo determinístico para saber o produto em foco, nem para detectar que ele mudou.

> **BLOQUEIO DE PROJETO REGISTRADO:** a identificação do produto em foco **não é determinística** no `homi-chat` hoje. Não proponho heurística de texto. Enquanto isso não for resolvido por um caminho determinístico (produto vindo da tela/lead aberto, por exemplo), qualquer filtro por produto se aplicaria a um valor que quase nunca chega.

---

## 7. Pacote de decisões para Lucas

### Bloqueiam a próxima fase técnica
- **J-A — Afirmações de valorização, liquidez, demanda e desconto.** Hoje o HOMI recebe, como se fosse verdade oficial, frases como "alto potencial de valorização" (Casa Tua, Open Bosque, Las Casas, Vértice), "alta demanda de locação" e "rentabilidade superior" (Melnick Day Compactos), "gerar locação via airbnb" (Shift), "alta liquidez" (Casa Bastian, via código). Em linguagem simples: **o sistema está ensinando o corretor a prometer retorno.** Você confirma alguma dessas com documento? As não confirmadas devem sair?
- **J-G — Produto em foco.** O HOMI não sabe, de forma confiável, sobre qual empreendimento você está falando. Você aceita que o produto passe a vir da tela/lead aberto (caminho determinístico), ou prefere que o corretor selecione o produto explicitamente?
- **J-B — Finalidade oficial dos 12 produtos** (moradia / investimento / ambos). Sem isso, o HOMI **não pode** recomendar produto alternativo; vai responder "preciso confirmar".

### Importantes, não bloqueiam
- **J-1 — Metragens oficiais**: Casa Tua, Open Bosque, Casa Bastian, Shift, Lake Eyre têm 2 ou 3 versões diferentes no sistema.
- **J-2 — Preços e condições oficiais**, e se saem do texto permanente passando a ser consultados na hora.
- **J-D — Las Casas e Vértice - Las Casas** são o mesmo produto com dois cadastros, ou dois produtos?
- **J-E — Melnick Day**: é evento, e o material fala de desconto e data já passada. Mantém, atualiza ou desativa?
- **J-F — Fallback no código** (seção 5).
- **J-H — Átrio - ABF**: cadastro vazio. Marcar como "sem ficha, não responder"?

### Editoriais, ficam para depois
- Limpar "💡 Dica para seu CRM e IA" de dentro do argumento do Open Bosque.
- Tirar entrega/ITBI/renda de dentro de "diferenciais".
- Padronizar nomes entre override, ficha e material (Open Bosque × Open Arvoredo; Vivid × Vivid - Mocellin).

---

## 8. Parecer final

**Fatos confirmados:** a RPC exclui documentos gerais quando se filtra por produto; o produto em foco não chega ao `homi-chat` no chat geral; existem conflitos internos de metragem em 5 produtos e de preço em 6; há afirmações de valorização/liquidez sem fonte em 7 dos 12; o `FALLBACK_BRIEF` entra na lista em toda requisição e contém dados divergentes do banco e um produto inexistente; só Casa Tua tem módulo próprio de Método; as fichas de empreendimento são de 1 chunk.

**Hipóteses:** que a saturação por prioridade seja a causa principal de o módulo específico não aparecer (ainda não medida); que o `diferenciais` do Casa Tua seja cópia do Orygem.

**Riscos principais:** promessa de retorno financeiro sem lastro (legal), informação técnica errada ao cliente (metragem/preço), e oferta vencida sendo tratada como vigente (Melnick Day).

**Já pode ser aprovado sem nova fonte:** o contrato de precedência (seção 4), a classificação perene × volátil (seção 3) e a regra de que dado volátil nunca é afirmado como atual sem consulta no momento.

**Ainda depende de fonte oficial sua:** finalidade, metragem, preço, disponibilidade, condições e todo argumento de valorização/liquidez.

**Alternativa A permanece segura?** **Não, como estava escrita.** Precisa de dois ajustes: (a) não usar `filter_empreendimento` isoladamente, porque isso derrubaria o Método; e (b) resolver antes o bloqueio de identificação determinística do produto. A parte da Alternativa A que **continua segura** é reduzir o pacote de empreendimentos injetado no prompt quando houver produto conhecido — mas hoje ele quase nunca é conhecido, então o ganho seria pequeno. Recomendo tratar **J-A e J-G como pré-requisitos** antes de qualquer mudança técnica.

---

Fase 0 concluída somente em leitura. Aguardando decisões de Lucas. Nada implementado, nada deployado, nenhum dado alterado.
