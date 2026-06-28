# Polimento final — Pipeline Mobile

Fiz uma verificação completa no preview mobile (440px), logado como CEO. Testei: header + troca de abas (Kanban / Inteligência / Equipes), busca fixa, pílulas de filtro, lista de cards, e o drawer de lead em tela cheia com a barra de ação fixa. **No geral está funcional e com boa paridade com o desktop.** Encontrei 3 ajustes de acabamento que faltam para ficar "perfeito".

## O que está bom (confirmado no preview)
- Abas no mobile (Kanban/Inteligência/Equipes) funcionando — gestão pelo celular OK.
- Busca sempre visível no Kanban, pílulas de status e botão atualizar OK.
- Lista de cards limpa, com animação de entrada.
- Drawer de lead abre em tela cheia com abas roláveis e barra de ação fixa.
- Aba Inteligência (funil/cards) renderiza bem no celular.

## Problemas encontrados (a corrigir)

### 1. Robô HOMI flutuante cobre a barra de ação do lead (bug real)
Quando o drawer de lead abre no mobile, o lançador flutuante do HOMI (`fixed z-[60]`, canto inferior direito) fica **por cima da barra de ação fixa** do rodapé, escondendo o botão **"+ Tarefa"**. É o ajuste mais importante.

```text
┌──────────────────────────┐
│  [ Ligar ] [ WhatsApp ] [+]│  ← "+" fica embaixo do robô HOMI
└────────────────────────🤖─┘
```

**Correção:** ocultar o lançador do HOMI enquanto o drawer de lead estiver aberto no mobile (mesmo padrão que o HOMI já usa: ele some quando o painel HOMI abre ou na rota /imoveis).

### 2. "Ligar" e "WhatsApp" duplicados na aba Info
Na aba **Info** já existe a grade completa de AÇÕES (Ligar, WhatsApp, Scripts, Anotar, Mais ações). A barra fixa do rodapé repete Ligar/WhatsApp — redundante só nessa aba. Nas abas Histórico/Tarefas/Visitas a barra fixa é essencial (lá não há a grade).

**Correção:** manter a barra fixa nas abas Histórico/Tarefas/Visitas e ocultá-la na aba Info (onde a grade já cobre tudo), evitando duplicação e ganhando espaço vertical.

### 3. Pequenos acabamentos visuais
- Garantir respiro inferior da lista para a barra de navegação inferior não cobrir o último card.
- Conferir alvos de toque ≥ 40px nos botões pequenos do header (atualizar, busca, filtros).

## Escopo técnico (somente frontend/apresentação)
- `src/components/homi/HomiAvatar.tsx`: ocultar o lançador quando um drawer de lead mobile estiver aberto.
- `src/contexts/HomiContext.tsx`: adicionar um sinal leve de visibilidade do lançador (`launcherHidden` + setter) reutilizável.
- `src/components/pipeline/PipelineLeadDetail.tsx`: acionar esse sinal no mount/unmount do drawer (mobile) e ocultar a barra de ação fixa na aba `info`.
- Sem mudanças em banco, RLS, edge functions ou no desktop. Tudo atrás de `isMobile`.

## Validação
- Reabrir o drawer no preview mobile e confirmar: barra de ação totalmente visível (sem o robô por cima), botão "+ Tarefa" acessível, sem duplicação na aba Info, e desktop intacto.
- Typecheck limpo.
