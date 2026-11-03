# Correção: "Meu time" sumido do menu do gerente

## O que encontrei
- Gabriel Vieira tem perfil de gerente correto no CRM, e o menu dele continua tendo o grupo "Time".
- O problema é o nome: dentro desse grupo, o item que antes se chamava **"Meu time"** agora aparece como **"Usuários"**. É o mesmo nome da tela de administração, por isso o gerente não encontra.
- Os outros pontos do CRM continuam dizendo "Meu time" (barra de baixo no celular, busca), então só o menu do computador e o título da página ficaram diferentes.

## O que vou fazer
1. No menu lateral do **gerente**, o item volta a se chamar **"Meu time"**, com o mesmo ícone, no grupo "Time".
2. Quando o gerente abrir a página, o título e a aba mostram **"Meu time"** e o subtítulo diz "Corretores da sua equipe".
3. Para CEO, diretora e admin continua **"Usuários"**, porque lá a tela serve para administrar todos os usuários do CRM.
4. Nenhuma permissão, equipe ou dado muda. Só nomes.

## Como vou conferir
- Entrar como Gabriel Vieira (gerente) no computador e no celular: ver "Meu time" no menu, abrir a página e ver os corretores dele.
- Entrar como CEO: confirmar que continua "Usuários".

## Detalhes técnicos
- `src/components/layout/Sidebar.tsx`: label do item `/meu-time` no grupo "Time" de `gestor` → "Meu time".
- `src/config/pageRegistry.ts` e `src/pages/MeuTime.tsx`: título/label da aba muda conforme o papel (gestor = "Meu time"; demais = "Usuários").
