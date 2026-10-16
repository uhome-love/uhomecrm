# Lucas (CEO) atendendo os próprios leads

## O que já existe
- **Tarefas**: já está no seu menu (Início → Tarefas) e abre por padrão em "Minhas tarefas".
- **Pipeline com "Meus leads"**: o seletor "Empresa | Meus leads" já aparece para você no topo do Pipeline.
  Em "Meus leads" aparecem só os leads em que você é o responsável.

## O que falta
Na Fila CEO, o botão **Repassar** mostra só gerentes, diretoria e corretores. Você não aparece na lista,
então hoje não dá para repassar um lead para você mesmo.

## O que muda
1. Incluir **Lucas Sarmento (CEO)** no topo da lista "Repassar" da Fila CEO, com o selo "CEO".
2. Repassar para você funciona igual aos outros: o lead fica seu, aparece em "Meus leads" no Pipeline
   e as tarefas dele aparecem em "Minhas tarefas".
3. Você não ganha o grupo "Modo Corretor" (sem Roleta, sem aceite, sem Oferta Ativa de corretor). Também
   não entra na Roleta nem na distribuição automática.

## Validação
- Abrir a Fila CEO → Repassar e conferir seu nome na lista.
- Criar um lead de teste, repassar para você, conferir em Pipeline → "Meus leads" e depois apagar o teste.

## Detalhes técnicos
- `FilaCeoRepassarDialog.tsx`: a lista de gestão passa a buscar perfis ativos com cargo `admin` além de
  gerente/diretor; `labelCargo('admin')` → "CEO"; CEO ordenado primeiro.
- Nenhuma mudança no banco, na Roleta ou no menu.
