# Trocar o segmento do empreendimento direto no Foco Corretores

## O que muda para você

Na aba **Empreendimentos** (Foco Corretores), a etiqueta de segmento de cada empreendimento (hoje só leitura: "S1 - Moradia", "S2 - Investimento"…) vira um **seletor**. Clicando nele você escolhe entre os 4 segmentos e a mudança salva na hora, com aviso de sucesso — igual ao botão de Ativo/Inativo que já existe ali.

Além disso, corrijo o **AWA** para **S2 - Investimento** (hoje está como S1 - Moradia, herdado do cadastro automático).

## Quem pode alterar

Mesma regra do liga/desliga: apenas CEO/Admin/Diretor. Para os demais perfis a etiqueta continua só leitura.

## Detalhes técnicos

- Migration (DDL): nova função `public.set_empreendimento_segmento(p_empreendimento_id uuid, p_segmento_id uuid)`, SECURITY DEFINER, espelhando o gate de papel de `set_empreendimento_ativo`, validando que o segmento existe em `roleta_segmentos`.
- DML pontual: `empreendimentos_canonicos` do AWA (`cda11585-…`) → `segmento_id` de S2 - Investimento (`409aeddf-…`).
- `src/hooks/useFocoCorretores.ts`: novo hook `useSetEmpreendimentoSegmento` chamando a RPC e invalidando as mesmas queries (`foco/empreendimentos-canonicos`, `foco/empreendimentos-com-leads`).
- `src/components/foco/FocoEmpreendimentosTab.tsx`: substituir o `Badge` de segmento por um `Select` compacto (mesma altura/estilo da linha) alimentado por uma consulta a `roleta_segmentos`; manter `Badge` quando o usuário não tiver permissão.
- Sem alteração em roleta, distribuição ou qualquer lógica que consome o segmento — só a edição do valor.

## Validação

Abrir /foco-corretores > Empreendimentos no preview, trocar o segmento do AWA para S2 - Investimento pela UI, confirmar o toast, recarregar e conferir que persistiu.
