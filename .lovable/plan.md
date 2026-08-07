# Foco Corretores: gerente não consegue salvar ("invalid empreendimento_id in list")

## O que está acontecendo (confirmado nos dados)
Alguns corretores têm, na alocação salva, empreendimentos que hoje estão **inativos**:

- Adriana Kaiser: Grand Park Moinhos, Terrace
- Douglas Costa: Grand Park Moinhos, Terrace
- Leo Dorneles: Grand Park Moinhos
- William Ferreira: Shift · Thalia de Oliveira: Avulso · Guilherme Dias: Terrace

A tela só mostra chips de empreendimentos ativos, então esses itens ficam **invisíveis** — mas continuam na lista enviada ao salvar. A regra do backend recusa qualquer empreendimento inativo, e o gerente vê "Erro ao salvar: invalid empreendimento_id in list" sem entender o motivo.

## Correção
Na linha do corretor (Foco Corretores):

1. Mostrar os empreendimentos inativos que estiverem na alocação como chip cinza com o rótulo "(inativo)", removível — o gerente passa a enxergar o que está travando.
2. Ao salvar, enviar apenas empreendimentos ativos: os inativos são descartados automaticamente (limpeza silenciosa da herança antiga). Assim o salvamento sempre passa.
3. Mensagem de erro mais clara caso ainda ocorra: "Algum empreendimento da lista está inativo — remova e salve novamente."

Nada muda em permissões: gerente continua podendo editar só a própria equipe.

## Detalhes técnicos
- `src/components/foco/CorretorFocoRow.tsx`: receber também a lista completa de canônicos (ativos + inativos) para mapear nomes; renderizar chips inativos com estilo `outline`/muted e sufixo "(inativo)"; no `onSave`, filtrar `draft` pelos ids ativos antes de chamar o callback; recomputar `dirty` considerando essa limpeza (se houver inativo herdado, o botão Salvar fica habilitado).
- `src/pages/FocoCorretores.tsx` / `src/components/foco/FocoEmpreendimentosTab.tsx`: passar a lista de canônicos incluindo inativos (`useEmpreendimentosCanonicos({ includeInactive: true })`) só para exibição; o multiselect de adicionar continua listando apenas ativos.
- `src/hooks/useFocoCorretores.ts`: no `onError` do `useSetAlocacao`, tratar `invalid empreendimento_id` com mensagem amigável.
- Sem migration: a RPC `set_corretor_alocacao` e as políticas permanecem como estão.

## Validação
Abrir /foco-corretores como CEO, na equipe do Junior: conferir chips "(inativo)" em Adriana e Douglas, remover/salvar e confirmar sucesso, e verificar na base que a alocação ficou só com empreendimentos ativos.
