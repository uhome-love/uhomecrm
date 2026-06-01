## Objetivo

Refinar os relatórios individuais de maio/2026 (1 PDF por corretor, 28 ativos) adicionando as novas métricas e listagens pedidas, reorganizando na ordem solicitada, e modernizando o visual com identidade UHOME (estilo do antigo relatório 1 a 1: fundo off-white, Deep Slate `#0A0E1A`, Indigo `#4969FF`, cantos 12px) e **avatar do corretor no cabeçalho**.

Fluxo: **gerar 1 PDF modelo primeiro** (corretor de volume médio) → mostrar imagens (capa + 3 páginas) → após seu OK, gerar todos os 28 + ZIP. Nenhuma alteração no app/banco/edge functions — apenas regeração dos artefatos.

## Novas métricas e fontes de dados

Confirmadas no banco:

1. **Roleta diurna x noturna** (`roleta_distribuicoes.janela`):
   - Diurna = `manha` + `tarde` + `dia_todo`
   - Noturna (por mérito) = `noturna`
2. **Descartes do mês** = leads cujo stage atual é "Descarte" com `stage_changed_at` no mês, por corretor (com split definitivo/reengajável via `tipo_descarte`).
3. **Leads ativos no pipeline** (snapshot atual) = leads do corretor `arquivado=false` e fora dos stages Descarte/Venda.
4. **Taxa de atualização do pipeline mensal** = leads ativos com `ultima_acao_at` (fallback `updated_at`) dentro de maio ÷ total de leads ativos.
5. **Campanha com melhor aproveitamento** = por campanha do corretor, taxa = visitas realizadas ÷ leads da campanha (mín. 3 leads p/ evitar ruído); destaca a melhor.
6. **Visitas realizadas detalhadas** (`visitas` status='realizada'): lista com **nome do cliente** (`nome_cliente`), **empreendimento** (`empreendimento`) e **situação** (`resultado_visita` traduzido: "Gostou/quer proposta", "Vai pensar", "Não gostou", "Quer ver outro", etc.).
7. **Leads que mais converteram** (página 2): clientes do corretor que viraram visita realizada e/ou negócio no mês (nome + resultado).

Mantidas: presenças (dias credenciados), leads recebidos, negócios criados, vendas, VGV assinado, origens, funil.

## Estrutura dos relatórios

### Cabeçalho (todas as páginas)
Faixa Deep Slate com barra indigo, **avatar circular do corretor** (download de `profiles.avatar_url`; fallback iniciais quando ausente — 3 dos 28), nome, equipe, gestor, wordmark UHOME e período.

### Capa
Avatar grande, nome, equipe/gestor, "01–31 de maio de 2026", identidade UHOME.

### Página 1 — Visão geral (KPI cards na ordem pedida)
```
presenças · roletas diurnas · roletas noturnas · leads recebidos
leads pipeline ativo · descartes · visitas criadas · visitas realizadas
negócios criados · vendas realizadas · VGV assinado · taxa atualização pipeline
```
Cada card: valor grande + mini-benchmark (você / time / empresa). Campanha de melhor aproveitamento em destaque.

### Página 2 — Conversão e origem
- Funil: Leads → Visitas criadas → Visitas realizadas → Negócios → Vendas (com % entre etapas).
- Origem dos leads recebidos (barras ordenadas, vs empresa).
- Leads que mais converteram no mês (visita e negócio) — lista de clientes + resultado.

### Página 3 — Plano e insights
- **Plano de melhoria** automático baseado nos números (gargalos do funil, no-show, atualização do pipeline).
- **Segmentos**: recomendação manter/trocar com base no aproveitamento das roletas/campanhas.
- **Metas para junho**: meta de visitas realizadas e de negócios (derivadas do desempenho + média do time).
- **Elogios, curiosidades e insights**.
- **Tabela de visitas realizadas** (cliente · empreendimento · situação).

## Técnico

- Atualizar `/tmp/fetch_data.py`: adicionar queries de roleta por janela, descartes (stage Descarte + tipo), leads ativos, taxa de atualização, aproveitamento por campanha, lista de visitas realizadas detalhadas, e leads convertidos. Respeitar BRT e mapeamentos de ID (`roleta_*`/`negocios`=profile/auth, `visitas`/`pipeline_leads`=user_id).
- Reescrever `/tmp/gen_reports.py` (reportlab) com novo layout, cabeçalho com avatar (baixar imagens para `/tmp/avatars/`, recortar circular), nova grade de KPIs e tabelas.
- Saída: 28 PDFs em `/mnt/documents/relatorios-maio-2026/` + `_TODOS_relatorios_maio2026.zip`.
- **QA obrigatório**: converter páginas em imagem (pdftoppm) e inspecionar o modelo (e amostras alto/médio/baixo volume) antes de entregar.

## Entrega em 2 etapas
1. Gerar **1 PDF modelo** e mostrar as imagens das páginas para sua aprovação.
2. Após OK (ou ajustes), gerar os 28 + ZIP.
