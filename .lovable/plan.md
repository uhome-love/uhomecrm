## Objetivo

Refinar completamente o visual dos relatórios individuais de maio/2026 (1 PDF por corretor, todos os times), corrigir o cálculo de **Presença** (hoje zerado) e adicionar **Visitas Criadas (total)** e **Visitas Realizadas**. Sem mexer no CRM/banco — apenas regerar os artefatos.

## Correções de dados

1. **Presença** (atualmente tudo zerado porque `checkpoint_diario`/`checkpoint_lines.real_presenca` estão vazios em maio):
   - Passar a usar `roleta_credenciamentos` como fonte real de presença.
   - Métrica: **dias presentes** = `count(distinct data)` por corretor em maio (`corretor_id = profiles.id`).
   - Mostrar como "Presenças (dias escalado)" com benchmark de time e empresa, e taxa sobre dias úteis.

2. **Visitas** (separar os dois números pedidos), via `visitas` (`corretor_id = profiles.user_id`):
   - **Visitas Criadas (total)** = todas as visitas do mês.
   - **Visitas Realizadas** = `status = 'realizada'`.
   - Extra leve: taxa de comparecimento = realizadas / criadas.

3. Demais métricas mantidas: roletas, leads, pipeline, negócios, VGV assinado, origens e campanhas, com benchmarks (corretor × time × empresa).

## Refinamento visual (mantendo identidade do CRM)

Paleta e estilo do CRM: fundo off-white, base Deep Slate `#0A0E1A`, destaque Indigo `#4969FF`, cantos arredondados ~12px, tipografia limpa.

Estrutura de cada PDF (organizada e moderna):
- **Capa enxuta**: nome do corretor, time, período "01–31 de maio de 2026", logo/wordmark UHOME, faixa indigo.
- **Página 1 — Visão geral**: grid de KPI cards alinhados (Presenças, Roletas, Leads, Visitas Criadas, Visitas Realizadas, Negócios, VGV) com valor grande, rótulo, e mini-benchmark (você vs time vs empresa) em barra.
- **Página 1/2 — Funil de conversão**: Leads → Visitas Criadas → Visitas Realizadas → Negócios → Vendas, com percentuais entre etapas.
- **Página 2 — Origens & Campanhas**: top origens de leads e campanhas com melhor aproveitamento (barras horizontais ordenadas), comparado ao destaque da empresa.
- **Página 3 — Insights**: curiosidades/insights automáticos a partir dos números, seção de elogios e de melhorias, e "Combinados para Junho".

Melhorias de layout: grid consistente, espaçamento uniforme, sem sobreposição de texto, sem glifos quebrados (emojis substituídos por ícones/símbolos suportados), contraste adequado, cabeçalho/rodapé com paginação e nota de rodapé sobre a fonte de presença.

## Entregáveis

- 28 PDFs em `/mnt/documents/relatorios-maio-2026/` (sobrescrevendo os atuais).
- `_TODOS_relatorios_maio2026.zip` atualizado.
- **QA obrigatório**: converter páginas em imagem (pdftoppm) e inspecionar várias amostras de corretores (alto, médio e baixo volume) para garantir layout limpo antes de entregar.

## Técnico

- Reescrever o script Python (reportlab) de geração, parametrizado por corretor.
- Queries agregadas por corretor respeitando timezone BRT e os mapeamentos de ID corretos:
  - `roleta_credenciamentos.corretor_id = profiles.id`
  - `visitas.corretor_id = profiles.user_id`
  - `roleta_distribuicoes.corretor_id = profiles.id`
  - `pipeline_leads.corretor_id = profiles.user_id`
  - `negocios.auth_user_id = profiles.id` (VGV `fase='vendido'`)
- Sem alterações em código do app, banco ou edge functions.
