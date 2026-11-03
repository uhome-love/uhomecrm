# Plano: auditoria de hoje + contribuição "UhomeSales em Movimento"

O documento completa a auditoria visual de hoje. A auditoria olhou com a conta do CEO. O documento olha da mesa do corretor: leitura, movimento e comemorações. As duas viram uma ordem única, com uma etapa por vez. Cada etapa passa por desenho, aprovação, construção e conferência ao vivo.

## Ordem de execução

```text
A  -> M0 -> B  -> M1 -> C(+marca) -> M2 -> M3 -> Rodada 2
```

### A — Erros e números (auditoria, vem primeiro)
- Pipeline com três totais diferentes (947 / 1.739 / 1.737), todos passando pela mesma regra de "pipeline ativo".
- Erro escondido do telefone que se repete em todas as páginas.
- Roteiros da Oferta Ativa e aba da página não encontrada.

### M0 — Base de movimento e leitura (não mexe em dado)
- Quatro tempos padrão: 100 / 160 / 240 / 400 ms, com curvas de entrada, saída e movimento.
- "Reduzir movimento" do celular passa a valer no CRM inteiro, não só em 4 estilos.
- Card só sobe com o mouse se der para clicar nele. Cartões de número ficam parados.
- Tirar o piscar sem motivo. Fica só em "ao vivo" e "atrasado".
- Letra mínima de 11 px nos selos e textos de apoio, começando pelo card do Pipeline e pela Minha Rotina.

### B — Consistência (auditoria)
Seletores de período, abas, títulos e cabeçalho padrão que ainda faltam.

### M1 — Abrir e trocar
- Ao abrir uma página, aparece o formato dela (esqueleto) no lugar do spinner grande.
- Troca de aba com um esmaecer curto, sem recarregar a página.

### C — Acabamento + marca (depende da sua decisão)
- Cores fixas, cartões zerados, espaços (auditoria).
- **Decisão pendente:** aplicar o azul #5271FF e a fonte Montserrat nos títulos, como foi decidido em outubro. Hoje o CRM usa #4969FF e Inter. Também reduzir de 6 para 2 as famílias de fonte carregadas.

### M2 — Rotina do corretor
- **Card do Pipeline:** um selo só, o mais urgente. Os outros aparecem ao passar o mouse e no lead aberto. Uma bolinha colorida mostra a urgência.
- **Minha Rotina:** saudação numa linha só, depois "Agora" (atrasadas e próxima visita), depois Meu foco hoje. A Roleta vai para o topo durante a janela de credenciamento, e a Missão de Natal fica recolhida no fim. Usa os mesmos blocos e os mesmos dados, só muda a ordem.
- **Concluir tarefa:** continua exigindo tipo de contato e observação. Ganha um check animado e a sugestão da próxima tarefa.

### M3 — Momentos de vitória
- Tarefa concluída: um check. Visita realizada: aviso com brilho. Venda: tela cheia por 2,5 s, uma vez só.
- Só comemora depois que o registro foi gravado. O som continua desligado por padrão.
- A comemoração que já existe é reaproveitada, junto com a de Natal enquanto a campanha estiver ativa.

### Rodada 2 — Conferência com os olhos certos
Contas de corretor e gerente, celular (390 px) e modo escuro, com a lista do documento: janelas da Roleta, bloqueio de visita, teclado ao concluir tarefa, arrastar no toque, gráficos e Arena no modo escuro.

## O que não muda
Regras de negócio, contagens, Roleta, distribuição, tarefas e dados. Só mudam o visual, o movimento e a ordem dos blocos. Nada é testado em lead real.

## Detalhes técnicos
- Tokens de duração e curva em `tailwind.config.ts` + `src/index.css`. `MotionConfig reducedMotion="user"` na raiz. Unificar os keyframes duplicados.
- O hover-lift sai de `.card-base`, `.kpi-card`, `.central-kpi`, `[data-slot=card]`, `.transition-lift`. Fica em variante `interactive` ou `[role=button]`/links.
- Trocar `transition-all` por propriedades específicas nas peças compartilhadas primeiro.
- Fallback do Suspense em `AppLayout.tsx` vira esqueleto genérico de página.
- M2: `CardMinimal.tsx` (prioridade dos selos), `CorretorDashboard.tsx` (reordenar), `RegistrarAtividadeModal.tsx` / `MeuFocoHoje.tsx`.
- M3: `CelebrationOverlay.tsx` chamado depois do sucesso da mutação.

## Próximo passo
Começar pelo desenho da Onda A. Antes da Onda C, preciso da sua resposta sobre a marca (azul #5271FF + Montserrat).
