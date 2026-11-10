# Topo da ficha do lead: limpeza visual

Só muda a aparência. Não há migration e nenhum dado ou regra muda. O histórico de etapas (pipeline_historico) continua como está.

## O que muda
1. **Sai do topo o bloco "Caminho do lead"** inteiro, com o rótulo e os chips.
2. **No fim da linha de dados**, depois de "produto · origem · entrou · corretor", entra um botão pequeno com o último movimento de etapa:
   - quando o lead volta no funil: "Voltou para Aquecimento · 01 nov", com o ícone Undo2 em text-primary;
   - quando avança: "Avançou para Qualificação · 20 out", com o ícone ArrowRight em text-muted-foreground;
   - letra de 12 px, ChevronDown no fim, truncate e sem quebra de linha;
   - lead sem movimento de etapa: o botão não aparece.
3. **Ao clicar, abre um Popover** com o caminho completo em lista vertical:
   - uma etapa por linha, com a data à direita;
   - a etapa atual destacada em bg-primary/10 text-primary;
   - quando o lead voltou, a linha diz "Voltou para X", com Undo2;
   - altura máxima de 280 px, com rolagem.
4. **Idas e voltas do mesmo dia somem só na exibição:** se o lead sai de uma etapa e volta para ela no mesmo dia (BRT), não aparece nem a ida nem a volta. A regra repete até não sobrar nenhuma.
5. **Topo do computador com 3 linhas e no máximo 150 px:** nome + pills, dados + botão, contatos. O espaço entre as linhas cai para 2 px e o padding de cima e de baixo diminui. As pills ficam na linha do nome, sem quebrar.
6. **Celular:** o botão vai para uma linha própria embaixo dos contatos. O Popover abre para baixo, na largura da tela.

## Arquivos (somente estes)
- `src/components/pipeline/drawer/DrawerTopo.tsx`: nova prop opcional `metaExtra?: ReactNode`. No computador, ela aparece no fim da linha de dados; no celular, numa linha embaixo dos contatos. A prop `faixa` sai e os espaçamentos ficam menores.
- `src/components/pipeline/drawer/CaminhoDoLead.tsx`: a lógica de passos (ordem e direção) que já existe vira uma função interna. O arquivo passa a exportar `UltimoMovimento` (o botão com o Popover) e `CaminhoLista` (a lista), já com o filtro das idas e voltas do mesmo dia.
- `src/components/pipeline/PipelineLeadDetail.tsx`: troca `faixa={<CaminhoDoLead/>}` por `metaExtra={<UltimoMovimento/>}`.

Tokens semânticos, sem cor fixa e sem emoji. Funciona no tema claro e no escuro.

## Como vou testar (no preview, só olhando, sem salvar nada)
- **Leonardo Prado:** topo em 3 linhas com até 150 px, linha de dados terminando em "Voltou para Aquecimento · 01 nov" e caminho completo sem a ida e volta de 14/10.
- **Lead novo, sem movimento:** sem o botão e com o topo em 3 linhas.
- **Nome longo com as três pills:** nada quebra para uma quarta linha no computador.
- **Celular (390 px) e tema escuro.**
- **Nada abaixo do topo muda:** vou comparar as capturas de tela.
