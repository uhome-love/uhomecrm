# Base Única de Leads (CEO) + Oferta Ativa por campanha temporária

Trazer os 38.260 contatos do HubSpot para dentro do CRM como **acervo próprio**, limpo e organizado por produto, e transformar a Oferta Ativa em um mecanismo de **campanhas com prazo**: eu filtro, libero por X dias, a equipe trabalha, e no fim colho o resultado.

## O que os dados já mostram

- 38.260 linhas · 36.930 telefones únicos (1.330 duplicados dentro do próprio arquivo)
- Leads de 2019 a 2026 — 2025 é o pico (14.4k), 2024 (6.7k), 2023 (3.6k)
- 6.462 já estão no pipeline · 12.135 já estão na Oferta Ativa · **18.819 são inéditos**
- 393 formulários distintos; ~29,6k leads casam direto com os 69 empreendimentos canônicos
- 175 formulários sem produto identificado (4D Complex House, Montenegro, Magno, Skyglass, Duetto, Hari Menino Deus, Vértice Las Casas, Freitas300, Pontal, Town.co, Achei/Yellow…) — parte é variação de nome, parte é produto extinto

## Fase 1 — Base única (armazenamento)

Uma tabela nova de acervo, separada do pipeline e da Oferta Ativa:

- Um registro por pessoa (chave: telefone normalizado; e-mail como chave secundária)
- Campos: nome, telefone, e-mail, data da primeira conversão, data da última conversão, formulário de origem, campanha, produto canônico, origem do dado (hubspot / meta / site / importação), status no CRM
- Histórico: uma pessoa que converteu 4 vezes guarda as 4 conversões (produto e data), não sobrescreve
- Importação idempotente: subir o mesmo arquivo de novo não duplica nada, só atualiza a última conversão

### Higienização na entrada

1. Descarta linhas sem telefone e sem e-mail válidos
2. Deduplica dentro do arquivo (fica a conversão mais recente, as antigas viram histórico)
3. Marca cada registro com o cruzamento contra o CRM:
   - `no_pipeline` (ativo, descartado, inativado ou arquivado) — 6.462
   - `na_oferta_ativa` — 12.135
   - `inedito` — 18.819
4. Nada é apagado: o marcador é o que impede o lead de ser oferecido de novo

## Fase 2 — Unificação de produtos

- Todas as variações de formulário do mesmo produto viram **um** produto canônico ("Casa Tua-Qualificado.-copy", "Casa Tua-Video Gabriel 2D", "Casa Tua-Validação-copy" → **Casa Tua**)
- Os 175 formulários sem match viram uma tela de revisão: cada um recebe "é o produto X", "é produto novo" ou "produto extinto"
- Produto marcado como extinto: fica na base para reengajamento genérico, **nunca** entra em campanha de Oferta Ativa

## Fase 3 — Página LEADS (visão CEO)

Nova página no menu, só para CEO/diretor/admin:

- **Painel**: total da base, inéditos, já no CRM, evolução por ano, top produtos, top campanhas
- **Explorar**: tabela com busca e filtros (produto, período, formulário, status no CRM, já contatado, com/sem e-mail), exportação CSV
- **Importar**: subir CSV do HubSpot/Meta, ver a prévia da higienização (quantos novos, quantos duplicados, quantos já no CRM) e confirmar
- **Revisão de produtos**: fila dos formulários não mapeados
- **Campanhas**: criar e acompanhar as liberações da Fase 4

## Fase 4 — Oferta Ativa como campanha temporária

O modelo que você pediu: filtro → libero → prazo → resultado.

1. Na página LEADS eu monto o filtro (ex.: Casa Tua + 2024/2025 + nunca contatado + com telefone)
2. Vejo quantos leads o filtro devolve e crio a **campanha**: nome, quem pode trabalhar (equipe/corretores), data de início e **data de expiração**
3. A campanha aparece na Oferta Ativa só dentro da janela; ao expirar, sai sozinha da tela dos corretores
4. Ao encerrar, um **resumo da campanha**: leads liberados, tentativas, aproveitados, visitas geradas, negócios, conversão — e o que sobrou volta para a base marcado como "já trabalhado em tal campanha"
5. Cooldown por lead continua valendo: quem foi tentado recentemente não entra em nova campanha antes do prazo

### O que acontece com o que existe hoje

- As 65 listas atuais são **arquivadas** (somem da operação), com todo o histórico de tentativas, aproveitados e pontuação preservado
- Os 12.341 leads dessas listas são absorvidos na base única com o histórico deles, para não serem oferecidos de novo como se fossem novos

## Fase 5 — Reengajamento e nutrição a partir da base

- A Central de Reengajamento passa a poder puxar público da base única com os mesmos filtros (produto, safra, nunca contatado)
- Continua 100% manual, respeitando as travas atuais de disparo e supressão
- Regra: um lead nunca está em campanha de Oferta Ativa e em disparo de reengajamento ao mesmo tempo

## Detalhes técnicos

- Tabelas novas: `base_leads` (registro único, telefone normalizado com índice único parcial), `base_leads_conversoes` (histórico N:1), `base_leads_import_runs` (auditoria de cada importação), `oferta_ativa_campanhas` (filtro salvo + janela + escopo) ligada a `oferta_ativa_listas`
- Reuso: `empreendimentos_canonicos` e `empreendimento_aliases` para o mapa formulário → produto; `normalize_telefone` para a chave; `oferta_ativa_leads`/`tentativas` seguem sendo a camada operacional
- Cruzamento com o CRM por telefone (8 últimos dígitos, padrão já usado) e por e-mail
- Listas atuais: `oferta_ativa_listas.status = 'arquivada'` (sem DELETE), leads inativados na fila
- RLS: base visível para admin/diretor/gestor; corretor só enxerga o que estiver liberado dentro de uma campanha ativa
- A importação dos 38 mil registros roda em lotes por função de backend, não pelo navegador

## Ordem de execução

1. Fase 1 (tabelas + importação higienizada dos 38.260) — valida os números comigo antes de gravar
2. Fase 2 (unificação de produtos + fila de revisão)
3. Fase 3 (página LEADS)
4. Fase 4 (campanhas temporárias + arquivamento das listas antigas)
5. Fase 5 (reengajamento a partir da base)

Cada fase é validada ao vivo antes de começar a seguinte.
