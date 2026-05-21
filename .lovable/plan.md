## Lote 2 — preparação das ondas 4, 5 e 6

**Tamanhos:** onda 4 = 100 · onda 5 = 300 · onda 6 = 500 · total = 900

### Mapeamento dos nomes que você enviou → nomes exatos no banco

Os nomes precisam bater literal com `oferta_ativa_leads.empreendimento`. Mapeamento + tratamento:

| Ordem | Você escreveu | Nome no banco | Únicos |
|---|---|---|---|
| 1 | vista nova carlos gomes | `Vista Nova Carlos Gomes` | 243 |
| 2 | vista menino deus | `Vista Menino Deus` | 230 |
| 3 | vista praia de belas | `Vista Praia de Belas` | 229 |
| 4 | caiz | `Caiz` **+** `Caiz React` (vou incluir os dois, depois desduplica por telefone) | 181 + 218 |
| 5 | demetrio abf | `Demétrio ABF` (com acento) | 200 |
| 6 | ~~caiz (duplicado)~~ | já incluído acima | — |
| 7 | go home desing | `Go Home Design` (corrigido) | 179 |
| 8 | go bom fim | `Go Bom Fim` | 166 |
| 9 | go moinhos | `Go Moinhos` | 162 |
| 10 | castro700 | `Castro700` | 133 |
| 11 | ora | `Ora Studios do Cais` | 101 |
| 12 | connect jw | `Connect JW` | 100 |
| 13 | go cidade baixa | `Go Cidade Baixa` | 51 |
| 14 | alfa | `Alfa` | 72 |

**Pool bruto disponível:** ~2.265 telefones únicos (antes de filtros). Folga grande para 900.

### Ordem final a enviar para `campanha-atrio-preparar-lote2`

```
Vista Nova Carlos Gomes → Vista Menino Deus → Vista Praia de Belas →
Caiz → Caiz React → Demétrio ABF → Go Home Design → Go Bom Fim →
Go Moinhos → Castro700 → Ora Studios do Cais → Connect JW →
Go Cidade Baixa → Alfa
```

### Execução (sem mandar para pipeline)

1. **Reset onda 4** de `concluida` (falso positivo) para `aguardando` em `campanha_atrio_controle`.
2. Chamar `campanha-atrio-preparar-lote2` com `force=true`, a lista de empreendimentos acima, `cap=900` e `ondas=[{4,100},{5,300},{6,500}]`.
3. A função:
   - Lê de `oferta_ativa_leads` por empreendimento na ordem.
   - **Desduplica telefone** (mesmo telefone só entra 1× no lote 2).
   - **Bloqueia** telefone em pipeline ATIVO (Novo Lead, Boas-vindas, Visita, etc.).
   - **Bloqueia** telefone já no lote 1 (ondas 1-3).
   - Insere em `campanha_atrio_audiencia` com `lote=2`, `lead_id=NULL`, `status=pending`.
   - Atualiza `total_alvo` dos controles 4/5/6.
4. **Não cria pipeline_lead, não notifica corretor, não envia para roleta.** O pipeline_lead nasce só quando o lead responder `Sim`/texto livre ao disparo (e aí sim cai na roleta, fluxo já validado).
5. **Validação pós-execução**: rodar SELECTs para mostrar contagem por onda, por empreendimento, e confirmar 0 sobreposições com lote 1 e 0 telefones em pipeline ativo.

### Resultado esperado

| onda | total_alvo | status |
|---|---|---|
| 4 | 100 | aguardando |
| 5 | 300 | aguardando |
| 6 | 500 | aguardando |

Pronto para você acionar o disparo manualmente quando quiser. Aprova?