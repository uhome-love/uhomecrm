## Objetivo

Preparar o lançamento do **Lake Baikal** em duas frentes:
1. **Roleta** — cadastrar o empreendimento para que os novos leads do lançamento sejam distribuídos no segmento **S4 - Alto Padrão**.
2. **Disparo de reengajamento** — deixar pronto o disparo, via Central de Disparos, para os leads antigos de **Lake Eyre** que já não estão ativos no pipeline (Descarte + Oferta Ativa), usando o template `lakebaical_novidade`. Quem responder "Sim" cai na **Fila do CEO** para você repassar manualmente.

Confirmado com você: o público é o de **Lake Eyre** (não existe lead gravado como "Golden Lake" — é o nome do bairro); os "estagnados" que continuam em etapa ativa ficam de fora por definição (o disparo remove quem está ativo no pipeline); e o template já está aprovado.

---

## O que já funciona (sem alteração)

- A **Central de Disparos** (`DisparoCustomizadoCard`) já combina os públicos **Descartados** (etapa Descarte do pipeline) + **Oferta Ativa (listas)** com dedup por telefone e **remove automaticamente quem está ativo no pipeline**, com filtro por **empreendimento** e escolha de template Meta.
- O roteamento de resposta **já está correto**: para os públicos de descartados/oferta ativa, "Sim" chama `reativar_lead_para_fila_ceo` (lead volta como *Novo Lead / Fila do CEO*, sem corretor, `pendente_distribuicao`) e "Não" inativa/arquiva. Nenhuma mudança de backend é necessária aqui.

---

## Mudanças a implementar

### 1. Hospedar a imagem de cabeçalho do template
Subir a arte do Lake Baikal para o bucket `campaign-images` em `reengajamento/lakebaical-novidade.png` (mesmo padrão dos templates atuais).

### 2. Mapear a imagem ao template no card de disparo
Em `src/components/central-nutricao/DisparoCustomizadoCard.tsx`, adicionar ao mapa `TEMPLATE_HEADER_IMAGES`:
```
lakebaical_novidade: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/lakebaical-novidade.png"
```
Assim, ao selecionar o template, a imagem do cabeçalho é preenchida automaticamente.

### 3. Cadastrar Lake Baikal na roleta (segmento S4 - Alto Padrão)
Inserir em `roleta_campanhas` uma linha:
- `empreendimento = 'Lake Baikal'`
- `segmento_id = 93ca556c-9a32-4fb8-b1af-148100ea47f0` (S4 - Alto Padrão)
- `ativo = true`

Isso faz com que **novos leads** que cheguem com empreendimento "Lake Baikal" sejam distribuídos no segmento Alto Padrão (o `distribuir_lead_atomico` resolve o segmento pelo nome do empreendimento em `roleta_campanhas`).

### 4. Incluir "Lake Baikal" na lista canônica de empreendimentos
Adicionar `"Lake Baikal"` em `src/lib/empreendimentos.ts` (usado nos seletores de Oferta Ativa/materiais).

---

## Como você vai disparar (passo a passo, depois de implementado)

Na **Central de Nutrição → Novo disparo**:
1. Canal: **Meta (template oficial)**.
2. Público: marcar **Descartados** + **Oferta Ativa (listas)** (selecionar as listas de Lake Eyre).
3. Filtro **Empreendimento**: `Lake Eyre`.
4. Em Descartados, escolher o tipo (reengajável/todos) conforme desejar.
5. Template: **lakebaical_novidade** (imagem de cabeçalho já preenchida).
6. Clicar em **Preview** para conferir a contagem e a amostra.
7. Clicar em **Disparar** — envia respeitando horário, throttle e cooldown já configurados.

> Volume de referência hoje: ~1.214 descartados em Oferta Ativa + 234 em Descarte no pipeline (Lake Eyre), antes dos filtros de segurança/dedup e cooldown de frequência.

---

## Detalhes técnicos

- Segmento S4: `roleta_segmentos.id = 93ca556c-9a32-4fb8-b1af-148100ea47f0` ("S4 - Alto Padrão").
- Fila do CEO: `reativar_lead_para_fila_ceo` move para stage `d3843b2f-2fa1-4c31-9129-4eb0ed21f019` com `aceite_status = 'pendente_distribuicao'` e `corretor_id = NULL` — exatamente o estado em que você repassa manualmente pelo `FilaCeoDispatchModal`.
- O disparo exclui quem está ativo via view `v_pipeline_ativo_contatos` e aplica cooldown de frequência (`freq_cooldown_dias`, padrão 14 dias). Leads recentemente contatados por marketing serão pulados.
- A inserção em `roleta_campanhas` é dado (insert tool); a alteração de imagem/lista de empreendimentos é código.

## Fora de escopo (a menos que você peça)
- Criar um novo tipo de público "estagnado" no card de disparo (hoje não existe; estagnados em etapa ativa são excluídos por design).
- Disparar automaticamente por mim — o envio real fica sob seu comando na Central.