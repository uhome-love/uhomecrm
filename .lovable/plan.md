## Objetivo
Gerar uma apresentação de resultados **Abril + Maio 2026** (reunião bimestral CEO → colaboradores), motivacional, no mesmo estilo visual do PDF "Reunião TRI 2026" (azul Uhome, pódios, troféus, gráficos). VGV calculado a partir da planilha oficial, **por corretor, com parcerias divididas igualmente (50/50)**.

**Decisões confirmadas:**
- Bruno Schuler (gerente) **sai do ranking de corretores**, conta só no ranking de equipes/gerentes.
- Slides "Corretor Destaque" de Abril e Maio ficam com espaço reservado para você preencher os nomes.
- Rankings: **pódio Top 3** nos meses + **ranking consolidado completo** do ano.
- Entrega em **PPTX editável + PDF** (faço o que der mais qualidade e te entrego os dois).

---

## DADOS FINAIS APURADOS

### Visão do bimestre
- **27 vendas | VGV R$ 17.951.292** (Abril R$ 5.012.260 · Maio R$ 12.939.032)
- **Leads: 3.226** (Abril 1.733 + Maio 1.493) — fonte UhomeSales

### Pódio CORRETORES — ABRIL (50/50 nas parcerias)
1. **Anderson — R$ 729.000** (2 vendas)
2. **Junior — R$ 615.000**
3. **William — R$ 606.000** (empate com Wendel R$ 606.000)
- 5. Luiza 604.500 · 6. Thalia 592.000 · 7. Larissa 337.000 · 8. Leo Dornelles 329.000 · 9. Jéssica 329.000 · 10. Matheus Pasin 264.760

### Pódio CORRETORES — MAIO (Bruno removido; 50/50 nas parcerias)
1. **Gustavo — R$ 1.544.890** (2,5 vendas)
2. **Anderson — R$ 783.000** (2 vendas)
3. **Rafaela — R$ 634.255** (1,5 venda)
- 4. Jéssica 628.076 · 5. Luiza 612.800 · 6. Paula 520.000 · 7. Eliézer 491.700 · 8. Cássio 433.869 · 9. Ebert 431.000 · 10. Thalia 419.442 · Leo 240.000

### Ranking GERENTES / EQUIPES
- **Abril:** 1º Gabrielle R$ 2.456.260 (6) · 2º Gabriel Vieira R$ 1.950.000 (4) · 3º Bruno Schuler R$ 606.000 (1)
- **Maio:** 1º Bruno Schuler R$ 9.821.845 (8) · 2º Gabrielle R$ 1.900.318 (5) · 3º Gabriel Vieira R$ 1.216.869 (3)

### RANKING CONSOLIDADO 2026 — CORRETORES (ano, Bruno fora, 50/50)
1. Matheus Pasin — R$ 4.455.319 (5,5)
2. Rafaela — R$ 3.397.631 (6,5)
3. Thalia — R$ 2.875.042 (6)
4. Leo Dornelles — R$ 2.799.192 (6)
5. Jéssica — R$ 2.176.629 (6)
6. Gustavo — R$ 2.163.771 (4)
7. Anderson — R$ 2.079.069 (6)
8. Luiza — R$ 1.984.481 (4)
9. Taynah — R$ 1.822.531 (4)
10. Halime — R$ 1.298.000 (3)
11. Samuel 996.880 · 12. Junior 983.466 · 13. Adriana 973.434 · 14. Flávio Dias 868.800 · 15. Eliézer 785.979 · 16. Ebert 729.000 · 17. Larissa 717.045 · 18. Gabriel 712.000 · 19. Nathalia 620.000 · 20. William 606.000 · 21. Wendel 606.000 · 22. Paula 520.000 · 23. Cássio 433.869 · 24. Guilherme 380.000

### Construtoras destaque
- Abril: Encorp R$ 3.089.500 (5) · Suelo 592.000 · Plaenge 409.000
- Maio: Multiplan R$ 6.200.000 · Plaenge 1.263.106 (3) · Encorp 1.104.500 · IAS 1.000.000

### VGV anual / comparativo histórico (planilha)
- 2026 acumulado (jan–jun): **R$ 41.184.137 — 75 vendas**
- 2025 R$ 68,5M (108) · 2024 R$ 45,6M (94) · 2023 R$ 25,4M · 2022 R$ 28,1M

---

## ESTRUTURA DA APRESENTAÇÃO (PPTX no estilo do PDF)

```
1.  Capa — "Resultados Abril + Maio 2026"
2.  Abertura motivacional — "Seguimos crescendo juntos"
3.  Destaques do bimestre (27 vendas · R$ 17,9M · 3.226 leads)
4.  CAMPEÕES CORRETORES — ABRIL (pódio Top 3 com troféu)
5.  CAMPEÕES GERENTES — ABRIL (pódio Top 3)
6.  Corretor Destaque ABRIL  [nome/valor a preencher]
7.  CAMPEÕES CORRETORES — MAIO (pódio Top 3)
8.  CAMPEÕES GERENTES — MAIO (pódio Top 3)
9.  Corretor Destaque MAIO  [nome/valor a preencher]
10. Maior nº de vendas no bimestre
11. Ranking de Construtoras (bimestre)
12. RANKING CONSOLIDADO 2026 — CORRETORES (lista completa)
13. RANKING CONSOLIDADO 2026 — GERENTES
14. Leads 2026 — evolução mensal (gráfico de barras)
15. VGV 2026 vs anos anteriores (gráfico) + acumulado do ano
16. Fechamento motivacional + metas do próximo período
```

## Implementação técnica
- Script Python (`python-pptx` + `matplotlib` para os gráficos), slides 1920×1080, paleta azul Uhome do PDF, pódios com medalhas/troféu.
- Salvar em `/mnt/documents/Resultados_Abril_Maio_2026.pptx` e exportar `/mnt/documents/Resultados_Abril_Maio_2026.pdf`.
- QA visual obrigatório: renderizar cada slide em imagem e conferir números, transbordo de texto e alinhamento antes de entregar.

## Pendência mínima
- Você me envia os nomes (e valor do prêmio) dos **Corretores Destaque de Abril e Maio** — posso gerar já com placeholders e você troca, ou aguardo os nomes antes de gerar.
