# Roleta no celular (desenho aprovado)

Muda só a aparência no celular. O computador, os botões e as regras ficam iguais.

## 1. Corretor, entrar no turno
- Título "Roleta", turno atual e tempo que falta para fechar a entrada.
- Escolha do turno em botões lado a lado (Manhã / Tarde / Noite), no lugar da lista suspensa. Turnos fechados ficam apagados.
- Cartão "Seus requisitos": visitas na semana, CRM em dia e leads sem resposta, com ✓ ou ✗. Os números vêm da mesma conta que a Roleta já usa para liberar a entrada. Se o número não carregar, a linha mostra "—" e não bloqueia nada.
- Cartão "Seus empreendimentos hoje", igual ao de hoje.
- Botão "Entrar na Roleta da tarde" preso embaixo, acima da barra de atalhos. Os avisos de domingo e da noite continuam aparecendo.
- As telas "Aguardando aprovação" e "Entrada fechada" ganham o mesmo visual.

## 2. Corretor, já na Roleta
- Posição grande no centro, selo "Você está na Roleta" e três números: leads hoje, esperando aceite e na fila agora.
- Lista por empreendimento, com posição e leads.
- "Sair da Roleta" em vermelho, com confirmação antes de sair.

## 3. Gestão, Central da Roleta
- Título com botão "+ Incluir" ao lado.
- Números numa faixa que desliza para o lado: na fila, distribuídos, aceite, Fila CEO e esperando aceite.
- Aviso "X pedidos para aprovar · Ver", que abre os pendentes.
- Abas: Ao vivo, Pendentes, Bloqueados e Mais. Em "Mais" ficam Leads, Inteligência e Config, com o conteúdo de hoje.
- Na fila ao vivo, deslizar o nome para a esquerda mostra "Tirar da fila", com confirmação.

## Validação
- Ver as telas em tamanho de iPhone com a conta do Lucas (gestão) e com a de um corretor, sem entrar nem sair de verdade, tocando em Cancelar nas confirmações.
- Conferir que o computador não mudou.

## Pendência
- Horário da entrada da noite: a tela do corretor diz 18:30 e o resto do sistema 18:00. Mantenho como está até você decidir.

## Detalhes técnicos
- Novo `src/components/roleta/corretor/mobile/` (`RoletaEntrarMobile`, `RoletaNaFilaMobile`) e `src/components/roleta/ceo/mobile/CentralRoletaMobile` com `FilaLinhaDeslizavel`. A troca é feita por `useIsMobile()` em `RoletaCorretorView`/`CentralRoletaCeo`, reaproveitando `useRoleta` (`removerDaFila`, `sairDaRoleta`, `aprovarCredenciamento`) e o `credenciar_por_alocacao` atual.
- Requisitos: `crm_saude_corretor` + contagem de visitas válidas da semana (mesma régua de `roleta_apto_janela`), somente leitura.
- Sem mudanças no banco.
