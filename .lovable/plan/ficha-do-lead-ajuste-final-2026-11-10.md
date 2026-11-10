# Ficha do lead: ajuste final

Só muda a aparência. Nenhum dado e nenhuma regra mudam.

## 1. Linha 2 do topo com a data sempre inteira
- Na última entrega, os botões já passaram a ficar só na linha do nome. A linha 2 já usa a largura toda e, na ficha do Leonardo, já aparece inteira ("Voltou para Aquecimento · 01 nov").
- Para garantir isso em fichas mais estreitas, o texto do último movimento fica em duas partes:
  - "Voltou para Aquecimento" pode ser cortado com "…" se faltar espaço;
  - "· 01 nov" e a setinha nunca são cortados.
- No celular, a linha continua quebrando normalmente quando não cabe.

## 2. Foco ao abrir a ficha
- Quando a ficha abre, o foco vai para o nome do lead (título da ficha), e não mais para o botão "Ligar". O nome só fica focável pelo sistema e não ganha contorno visível.
- O Tab continua começando pelos botões do topo, e o leitor de tela anuncia o nome do lead ao abrir.

## 3. Resumo do lead: Origem
- Quando o nome da campanha for igual ao Interesse (sem diferença de maiúsculas ou espaços), aparece só a origem, por exemplo "Meta".
- Quando for diferente, continua "Meta · nome da campanha".

## Arquivos
DrawerTopo.tsx, PipelineLeadDetail.tsx e ResumoLeadLateral.tsx.

Para o item 1 também é preciso ajustar o botão do último movimento, que fica em CaminhoDoLead.tsx; ele é só a parte de exibição desse botão. Se preferir que eu não mexa nele, faço o corte só pelo topo, mas aí a data pode ficar menos protegida.

## Como vou testar (Leonardo Prado, sem salvar nada)
- **Computador, ficha em 70% de 1440 px:**
  - data inteira na linha 2;
  - "Ligar" sem contorno ao abrir, com o foco no nome;
  - Tab chegando aos botões;
  - Origem mostrando só "Meta".
- **Ficha estreita:** só o nome da etapa é cortado, nunca a data.
- **Celular (390 px):** as mesmas conferências.
