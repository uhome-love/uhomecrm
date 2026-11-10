# Ficha do lead: rodada 2 de limpeza

Só muda a aparência. Não há migration e nada muda na forma de gravar.

## 1. Erro do caminho: o que causou e como fica
**Causa, conferida no banco.** A suspeita não se confirmou: o Pós-Visita está na lista de etapas que a ficha usa. O problema está no histórico do Leonardo: ele tem os registros Novo Lead → Sem Contato → Qualificação (20/10) e depois Pós-Visita → Aquecimento (01/11). **Não existe registro da entrada em Pós-Visita.** Provavelmente a visita levou o cliente para lá sem gravar a troca no histórico.

O caminho antigo comparava cada etapa com a anterior da lista, ou seja, comparava Qualificação com Aquecimento. Por isso dizia "Avançou" e não mostrava o Pós-Visita. Já a linha do tempo lê a etapa de origem gravada no próprio registro (Pós-Visita) e por isso dizia "Voltou".

Na última entrega corrigi isso só dentro do caminho, com uma regra própria. O botão já mostra "Voltou para Aquecimento · 01 nov", e o Pós-Visita aparece sem data.

**Agora:**
- O caminho passa a usar **a mesma função de direção da linha do tempo**, em vez de ter uma regra própria.
- O caminho e a linha do tempo recebem **a mesma lista de etapas** que a ficha já carrega.
- Quando falta o registro de entrada numa etapa, ela continua no caminho com a data "sem registro".
- Nada muda no banco.

## 2. Topo em 3 linhas, no máximo 130 px
- **Linha 1:** avatar, nome inteiro e, à direita, Ligar, WhatsApp, Agendar visita, ⋯ e fechar. As pills saem desta linha, então o nome não é mais cortado por causa delas.
- **Linha 2 (situação):** etapa ▾ · Retomar em / Definir prazo ▾ · temperatura · último movimento ▾.
- **Linha 3 (contato):** telefone (copiar, editar) · "DDD 44 · PR" · e-mail (copiar) · ícone de pessoa e nome do responsável.
- **Saem do topo:** empreendimento, origem e "entrou em". Eles vão para o Resumo.
- Vou testar com a ficha em 70% de uma tela de 1440 px.

## 3. Card "Próximo passo" mais curto
- **Sem a barra vermelha e sem a linha de dias.** Fica só o selo "Parado há 18 dias", com tooltip "Prazo da etapa: 15 dias".
- **Tarefa vencida:** a data vira uma linha só, "Venceu há 16 dias · 25/10, 10:00". A explicação passa a ser "É da etapa anterior (Pós-Visita)." Concluir e Trocar tarefa continuam.
- **Homi recolhido:** uma linha só com 44 px de altura (avatar, "Sugestão do Homi", Ver e a seta). Aberto, continua igual.

## 4. Resumo do lead
- **Linhas:** Interesse · Origem · Entrou · Orçamento · Visitas.
- **Sai "Último contato".**
- **Origem:** mesmo rótulo de grupo que o topo usava ("Meta"), seguido da campanha, nunca código cru como "ig".

## 5. Linha do tempo
- **Sai a frase "Abre o registro de sempre, já preenchido."**
- **Resultado da visita:**
  - título "Visita realizada · Terrace, 11:00";
  - chip verde com check para o resultado (ex.: "Quer proposta");
  - chip cinza com ícone de chama para a temperatura (ex.: "Muito quente");
  - a observação embaixo.
  - Se o texto não puder ser separado em partes, ele aparece inteiro, sem emojis.
- **Visita agendada:** "Para 23 out, 11:00 · Terrace".

## Arquivos (somente estes)
DrawerTopo.tsx, CaminhoDoLead.tsx, DrawerAgora.tsx, HomiSugestaoRecolhida.tsx, ResumoLeadLateral.tsx, LeadHistoricoTab.tsx e PipelineLeadDetail.tsx.

A função de direção da linha do tempo é só reaproveitada no caminho; o arquivo onde ela fica não será editado. Tokens semânticos, sem hex e sem emoji. Funciona no tema claro e no escuro.

## Como vou testar (no preview, sem salvar nada)
- **Leonardo Prado** em 70% de 1440 px:
  - nome inteiro e topo em 3 linhas com até 130 px;
  - "Voltou para Aquecimento · 01 nov", com Pós-Visita no caminho;
  - card sem barra e Homi em uma linha;
  - Resumo sem "Último contato";
  - visita com chips.
- **Outros casos:** nome longo, lead sem tarefa, lead novo sem troca de etapa, celular (390 px) e tema escuro.
