## Destacar leads em parceria com cor roxa no pipeline

Hoje o card do pipeline (`CardMinimal`) já recebe `parceiroNome` e mostra o nome do parceiro com o ícone 🤝 no rodapé. Visualmente, porém, ele fica idêntico a um lead normal — só dá pra notar lendo o rodapé.

### O que vai mudar

Quando o lead for de parceria (`parceiroNome` presente), o card vai ganhar:

1. **Anel/borda roxa sutil ao redor do card** (`ring-1 ring-purple-400/60` + `border-purple-300/60`), sobrepondo a borda padrão — mantém o card limpo, mas imediatamente reconhecível como "compartilhado".
2. **Fundo levemente tingido de roxo** (`bg-purple-50/40` no light, `bg-purple-950/10` no dark) para reforçar sem agredir.
3. **Badge "🤝 Parceria"** roxo no header, ao lado do nome do lead (mesmo padrão visual do badge "Novo"), para ficar óbvio mesmo com o card scrollado.
4. O ícone 🤝 + nome do parceiro no rodapé ganha cor roxa (`text-purple-600 dark:text-purple-400`) em vez do cinza atual.

A **borda esquerda 4px** (vermelho/âmbar/verde/cinza por status da tarefa) **continua igual** — é a informação operacional principal e não pode ser perdida. O roxo é uma camada visual adicional.

### Escopo

- Só `src/components/pipeline/CardMinimal.tsx`.
- Sem mudanças em hooks, banco, lógica de parceria ou regras de negócio.
- Funciona automaticamente nos dois lados da parceria (corretor 1 e corretor 2), porque ambos já recebem `parceiroNome` via `usePipeline`.

### Fora de escopo

- Lead detail drawer, central de tarefas, modo foco, oferta ativa — só pediu "no CRM"/pipeline. Se quiser estender depois, é trivial.
- Cor configurável: vai fixo em roxo (tom da identidade visual, alinhado com o gradient atual `#4F46E5 → #7e22ce`).
