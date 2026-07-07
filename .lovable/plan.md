
# Simulador de Financiamento Imobiliário (crítico, taxas auditadas Jul/2026)

Ferramenta no CRM para o corretor simular financiamento com taxas reais e auditadas dos principais bancos e pelo **Minha Casa Minha Vida (Caixa)**, com demonstrativo de parcelas e PDF moderno para enviar no WhatsApp. Como a simulação é crítica, inclui verificação de atualização de taxas, limites de idade e validação/testes ao final.

## Onde fica
- Item **"Simulador de Financiamento"** no menu lateral, grupo **Vendas**. Rota `/simulador-financiamento`. Todos os corretores + gestão.

## Dois modos
1. **Convencional (SBPE/SFH)** — Caixa, Itaú, Santander, Bradesco, BB.
2. **Minha Casa Minha Vida** — habilitado quando o banco é **Caixa** (toggle).

## Campos (auto-formatados e fáceis)
- Dinheiro (**valor do imóvel, entrada, valor financiado, renda**) pré-formatado em R$ via `src/utils/currencyFormat.ts`. Entrada alterna R$ ↔ %; financiado recalcula. Ajuda curta por campo; botão grande "Simular".
- **Banco**, **Sistema** (SAC/PRICE), **Taxa a.a.** (pré-preenchida e editável), **Prazo** (atalhos 20/25/30/35 anos).
- **Data de nascimento / idade** (novo — necessária para o limite de idade).

## Limites de idade (regra bancária brasileira)
- **Idade mínima: 18 anos** (ou emancipado).
- **Idade final máxima: 80 anos e 6 meses** (padrão Caixa e maioria dos bancos) → o simulador calcula o **prazo máximo permitido** = `(80 anos 6 meses − idade atual)`, em meses, e o limita automaticamente também ao teto do banco/faixa. Se o prazo escolhido estourar, avisa e ajusta.

## Auditoria — taxas convencionais (Jul/2026)
Fontes cruzadas (Monitor LARYA + SFH Finaqui). Selic 14,25%, teto SFH R$ 2,25 mi. Taxas + TR, sujeitas à análise de crédito.

```text
Banco             Taxa a.a. (balcão)   Sistemas     Prazo máx.   Financia até
Caixa             a partir de 11,19%   SAC / PRICE  420 meses    80% (SFH)
Itaú              a partir de 11,60%   SAC / PRICE  360 meses    82%
Santander         a partir de 11,70%   SAC / PRICE  420 meses    80%
Bradesco          a partir de 11,70%   SAC / PRICE  360 meses    80%
Banco do Brasil   a partir de 12,00%   SAC / PRICE  420 meses    80%
```

## Auditoria — Minha Casa Minha Vida 2026 (Portaria MCID 333; Caixa desde 22/04/2026)
Confirmado em gov.br + fontes cruzadas. Indexador TR, comprometimento máx. 30% da renda, prazo até 420 meses.

```text
Faixa    Renda bruta familiar     Taxa a.a. (ref.)        Teto imóvel   Observação
Faixa 1  até R$ 3.200            4,00% (N/NE) · 4,25%       ~R$ 255–270k  Seleção via prefeitura/HabitaCaixa (sem cálculo de parcela)
Faixa 2  R$ 3.200,01–5.000       ~5,5–6,5%                  R$ 270–350k   Subsídio até ~R$ 55.000 (estimativa, decrescente c/ renda)
Faixa 3  R$ 5.000,01–9.600       até 7,66%                  R$ 400.000    Sem subsídio direto
Faixa 4  R$ 9.600,01–13.000      10%                        R$ 600.000    Entrada mín. 20%, sem subsídio
```
- **Enquadramento automático** por renda + valor do imóvel; aplica a taxa da faixa (editável), valida teto do imóvel e entrada mínima; avisa quando não se enquadra. Faixa 1 apenas informa o caminho (não simula parcela). Notas de tipo de imóvel (novo/usado/planta) e FGTS como informativo.

## Verificação/atualização de taxas (botão "Atualizar taxas")
- Botão que chama uma **edge function** para buscar as **taxas de referência atuais** (via pesquisa web/Firecrawl das fontes auditadas e, quando disponível, dados públicos do Banco Central) e **comparar** com as taxas configuradas no código.
- Mostra um painel: taxa configurada × taxa encontrada por banco/faixa, **data da última auditoria** e um selo "✅ atualizado" ou "⚠️ divergência encontrada — revisar".
- **Não reescreve o código sozinho** (segurança): sinaliza a divergência para você aprovar a atualização. Assim a simulação continua 100% controlada e auditável.
- Cada banco/faixa exibe `data_referencia`; a tela e o PDF sempre mostram "Taxas de referência: Jul/2026".

## Consulta de CPF / restrição (fase opcional, requer aprovação)
- Verificar restrição de CPF (Serasa/SPC/Boa Vista/Quod) exige **API paga de bureau de crédito** + tratamento de dados pessoais sob **LGPD** (consentimento do titular, finalidade, não armazenar sem base legal).
- Proposta: **Fase 2 opcional** — implementar via edge function segura com a chave da API (guardada como secret) **somente após você contratar um provedor e confirmar**. Incluiria: campo CPF com máscara/validação de dígito, botão "Consultar restrições", retorno resumido (sem expor score bruto indevidamente) e checkbox de consentimento.
- Nesta primeira entrega deixo o ponto preparado (espaço na UI + aviso), sem chamar bureau até você fechar o provedor.

## Resultado (demonstrativo)
- **Resumo:** financiado, taxa a.a./a.m., prazo, sistema, 1ª/última parcela, total pago, total de juros; no MCMV: faixa + subsídio estimado (quando aplicável).
- **Análise de renda:** 1ª parcela vs **30% da renda** (limite oficial) — selo verde/vermelho + parcela máxima.
- **Análise de idade:** confirma prazo dentro do limite de 80 anos e 6 meses.
- **Tabela de parcelas:** nº, prestação, juros, amortização, saldo (resumo anual + primeiras/últimas, "ver todas").

## PDF personalizado, moderno e pronto para WhatsApp
- A4 retrato, logo U.Home, faixa em gradiente do design system.
- **Bloco do corretor:** nome, foto, WhatsApp, e-mail (perfil autenticado) + CTA "Fale comigo".
- Cartões de destaque (imóvel, entrada, financiado, banco/faixa, 1ª parcela grande), resumo com ícones, selos de renda/idade, mini tabela anual.
- Rodapé com fonte + data e aviso legal: *"Simulação estimativa (Jul/2026, + TR, sem seguros/CET). No MCMV, enquadramento/subsídio/taxa dependem da análise da Caixa. Condições finais sujeitas à aprovação do banco."*
- Botões **"Baixar PDF"** e **"Compartilhar"** (Web Share API → WhatsApp).

## Lógica de cálculo
- PRICE: `PMT = PV·i/(1−(1+i)^−n)`. SAC: amortização `PV/n`, juros `saldo·i`, decrescente. `i_m=(1+i_a)^(1/12)−1`. Valores via `fmtMoney`.

## Validação e testes (ao final — obrigatório)
- **Testes unitários** dos cálculos (`src/lib/financiamento.ts`): PRICE e SAC conferidos contra referência auditada (R$400k/360m SAC Caixa ≈ R$4.839; 1ª parcela, última, total de juros), enquadramento MCMV por renda/valor, e limite de idade/prazo.
- **Teste de fluxo (Playwright)** na preview: preencher, simular convencional e MCMV, ver demonstrativo, gerar PDF, acionar "Atualizar taxas" — com screenshots e verificação de console/erros.
- Correção de bugs até zerar; só então concluo. Relato o que foi verificado.

## Detalhes técnicos
- `src/pages/SimuladorFinanciamento.tsx`; cálculos em `src/lib/financiamento.ts`; config em `src/lib/bancosFinanciamento.ts` + `src/lib/mcmvFaixas.ts`.
- Edge function `verificar-taxas-financiamento` (Firecrawl/web + BCB) para o botão de atualização.
- Campos monetários reusam `src/utils/currencyFormat.ts`. PDF via html2pdf (base `centralPdf.ts`) com dados do corretor.
- Registro em `pageRegistry.ts` + item no grupo Vendas. UI no design system (tokens, radius 12px, sem cores hardcoded).

## Fora de escopo desta entrega
- Consulta real de CPF (Fase 2, requer API paga + LGPD).
- CET completo, TR variável, seguros MIP/DFI e cálculo exato de FGTS/subsídio.
- Reescrita automática das taxas (o botão apenas sinaliza divergência para aprovação).
