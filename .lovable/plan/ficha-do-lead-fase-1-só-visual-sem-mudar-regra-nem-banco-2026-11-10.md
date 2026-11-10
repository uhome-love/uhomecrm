# Ficha do lead — Fase 1 (só visual, sem mudar regra nem banco)

Baseado no pacote enviado (PROMPT-1 + imagens 01/02/03 + código de referência). A Fase 2 (próximo passo obrigatório, objeção, parcela que cabe, prazo obrigatório no Aquecimento, temperatura no registro) fica para depois, com plano próprio.

## O que o corretor vai ver

**Topo**
- Temperatura vira selo neutro com ícone de chama (vermelho fica só para problema).
- Sai o selo "Desatualizado · Xd" do topo; o alerta mora só no card Próximo passo.
- Em Aquecimento: "Retomar em: {prazo}" ou, sem prazo, selo âmbar tracejado "Definir prazo" (abre a mesma escolha de hoje).
- Ao lado do telefone: "DDD 44 · Paraná" quando o número é de fora do RS.
- Botões: Ligar e WhatsApp com contorno, "Agendar visita" azul (abre o formulário de visita de sempre). "Anotar" sai do topo.
- Faixa "Caminho do lead": etapas por onde passou, com data e aviso "Voltou para…" (some se só tiver uma etapa).

**Coluna esquerda**
- Card "Próximo passo": um alerta só ("Parado há N dias" + barra), tarefa com aviso "Ficou da etapa anterior…" quando for o caso, e Homi recolhido.
- Homi só chama a IA quando o corretor clica em "Ver" (abrir a ficha não gasta IA).
- Card "Resumo do lead": interesse, orçamento, visitas, último contato, origem.

**Histórico**
- Campo livre no topo ("Registre o que aconteceu…") com Ligação/WhatsApp/Visita/Nota + Registrar → abre o mesmo formulário de registro de hoje, já preenchido.
- Filtro "Atendimento | Tudo | Conversa Lia" (Tudo = completo, com total).
- Mudança de etapa: "Voltou/Avançou para X", observação em destaque e selo "De X para Y".
- Visitas: sem caixa amarela; resultado em caixa neutra; agendada mostra só data e imóvel.
- Ícones de traço no lugar de emoji.
- Faixa âmbar "N dias sem registro" quando há 7+ dias entre registros de atendimento (texto genérico; o texto específico é Fase 2).

**Celular**: mesma ordem, Homi recolhido, barra fixa de baixo igual a hoje.

## O que NÃO muda
Nenhuma tabela, regra, gatilho, função de servidor ou forma de gravar atividade/tarefa/etapa/visita. Nada é apagado.

## Como vou testar (preview)
Leonardo Prado comparado à imagem 02 (só olhando, sem salvar); lead em dia; lead sem tarefa; lead em Qualificação; tema escuro; celular 390px. Registro pelo campo novo testado só no cliente "TESTE LIA NAO LIGAR", apagando o que gravar ao final.

## Detalhes técnicos
Arquivos novos (base em `codigo/`, ajustados ao código atual): `drawer/HomiSugestaoRecolhida.tsx`, `drawer/CaminhoDoLead.tsx`, `drawer/ResumoLeadLateral.tsx`, `drawer/RegistroRapido.tsx`, `src/lib/dddUf.ts`, `src/lib/timelineNarrativa.ts` (+ teste pequeno de `dddUf` e `buracosSemRegistro`).
Substituir: `drawer/DrawerAgora.tsx` (props antigas mantidas; novas opcionais `saude`, `tarefaDeEtapaAnterior`, `homi`, `esconderRegistrar`).
Alterar: `PipelineLeadDetail.tsx` (já tem 1289 linhas — a parte do topo/pills sai para um componente próprio para não crescer), `DrawerTopo.tsx` (prop `localTelefone`, ações), `LeadHistoricoTab.tsx` (prop `onRegistrar`, filtros, `buildTimeline` guarda etapa anterior/nova/observação separadas), `RegistrarAtividadeModal.tsx` (só `tipoInicial`/`obsInicial` como valor inicial).
Homi usa a mesma função `homi-assistant`, chamada só ao abrir. Só tokens do tema, sem hex, sem emoji.
