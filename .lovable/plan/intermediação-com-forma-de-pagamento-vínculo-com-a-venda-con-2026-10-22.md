# Intermediação com forma de pagamento + vínculo com a venda + construtoras oficiais

Complemento do plano Financeiro aprovado. Segue o padrão: desenho primeiro, aprovação, depois construção.

## 1. Forma de pagamento na intermediação (obrigatória)
Ao criar a intermediação, o gerente escolhe uma opção:

| Forma | Quem recebe | Desconto |
|---|---|---|
| ZemoBank | Cada pessoa recebe a sua parte pelo Zemo | nenhum |
| Nota fiscal | A Uhome recebe tudo e repassa depois | **10% do valor bruto da comissão**, descontado da parte de todos |
| PIX | Direto na conta de cada pessoa | nenhum |

- **Open Bosque e Open Arvoredo** (construtora Open) já abrem com "Nota fiscal" marcada, mas o gerente pode trocar para PIX (por exemplo, quando o cliente paga a entrada). A escolha é sempre do gerente.
- Com nota fiscal, a divisão mostra três linhas: comissão bruta, desconto da nota (10%) e valor líquido distribuído. Cada pessoa vê o valor dela já com o desconto.
- O documento gerado deixa isso escrito: "Forma de pagamento: Nota fiscal — a Uhome Imóveis recebe o valor integral e repassa a cada beneficiário, já descontados 10% referentes à nota fiscal." O quadro de pagamentos mostra o bruto, o desconto e o líquido.
- Com Zemo ou PIX, o documento mostra a forma escolhida e o quadro de sempre.

## 2. Intermediação ligada ao cliente e à venda
- O primeiro passo da intermediação passa a ser "Buscar cliente no Pipeline". O gerente escolhe o cliente, e a tela preenche sozinha: comprador, empreendimento, construtora, unidade, VGV e corretor.
- A intermediação fica ligada ao negócio. Assim, no "Confirmar venda" (Ganho), ela já aparece anexada.
- Uma intermediação por venda. Se já existir, aparece "Esta venda já tem intermediação. Abrir ou gerar nova versão?". Isso evita repetições como as 10 da Andressa.

## 3. Vendas antigas sem intermediação
- Ficam só com o VGV, sem comissão e sem cobrança no Financeiro. O controle completo vale daqui para frente.
- Quando a intermediação existir no Drive ou no CRM, a ligação feita na conferência continua valendo.

## 4. Construtoras oficiais
Gravadas no cadastro oficial dos empreendimentos. Ao escolher o empreendimento, a construtora vem automaticamente:

```text
Open Bosque, Open Arvoredo .............. Open
Mood, Shift ............................. Plaenge
The Arch, Boa Vista Country Club,
Connect JW (João Wallig), Skyline Menino
Deus, JP Redenção ....................... Cyrela
Montenegro .............................. MRV
GPM (Grand Park Moinhos) ................ Melnick
Duetto .................................. Morana
Lake Eyre, Lake Victoria ................ Multiplan
Átrio, Casa Bastian, Hola ............... ABF
Las Casas ............................... Suelo
Salzburg ................................ IAS Engenharia
Casa Tua Porto Alegre, Casa Tua Canoas .. Encorp
Lév ..................................... Giardino
Alto Lindóia ............................ Florença
Agapanthus .............................. BR4T
Villa Pietra ............................ Krebs
Avulso .................................. Imóvel de terceiros
```
- As vendas existentes desses empreendimentos ganham a construtora certa, com o nome padronizado ("Cyrela", e não "CYRELA").
- Empreendimentos fora da lista aparecem numa lista "sem construtora" para você completar.

## 5. Sugestões (para você decidir)
1. **Percentual da nota configurável**: 10% fica como padrão, mas pode ser mudado no Financeiro, se o imposto mudar, sem precisar mexer no sistema.
2. **Forma padrão por construtora**: além da Open, outras construtoras podem já abrir com a forma que costumam usar.
3. **Repasse no Financeiro**: quando for nota fiscal, o Financeiro mostra "Recebido pela Uhome" e "Repassado ao time" por pessoa. Assim você vê quem ainda não recebeu o repasse.
4. **Aviso ao gerente** quando um cliente for para Ganho sem intermediação, com o botão "Gerar intermediação" já preenchido.

## Ordem
1. Desenho da tela de intermediação nova (cliente, forma de pagamento, quadro com desconto) e do trecho do documento. Você aprova.
2. Construção, com mudanças no banco só depois das 19h.
3. Teste com cliente de teste: gerar uma com nota fiscal (Open Bosque) e uma com PIX, conferir as contas e o documento e depois apagar.

## Detalhes técnicos
- `intermediacoes`: novas colunas `forma_pagamento` (zemo|nota_fiscal|pix), `desconto_nf_pct` (padrão 10), `negocio_id`, `pipeline_lead_id`, `valor_bruto`, `valor_liquido`. São todas opcionais, então as antigas não quebram.
- Índice único parcial por `negocio_id` para intermediações ativas.
- `empreendimentos_canonicos`: preencher `construtora` com a lista acima. A construtora padronizada é atualizada nas vendas por `empreendimento_canonico_id` e alias. É só ajuste de dados, sem migration.
- Forma padrão NF (não travada) para os canônicos da construtora Open; `forma_pagamento` obrigatória, conferida também na edge `gerar-intermediacao`.
- `IntermediacaoPage.tsx` (1.002 linhas) é dividida: seletor de cliente, seletor de forma e quadro de cálculo viram componentes. A função de cálculo vira lib com teste: NF 10% sobre o bruto, soma das partes = líquido.
- Edge `gerar-intermediacao`: texto da forma de pagamento e quadro bruto/desconto/líquido no .docx.
- Salvar em memória: regra NF −10% / Open sempre NF / tabela de construtoras.
