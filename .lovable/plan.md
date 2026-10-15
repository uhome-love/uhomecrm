# Open Arvoredo — validar modelo do WhatsApp e cadastrar no CRM

## 1. Validação do modelo `openarvoredo_novidade`
Está bom para aprovação da Meta (Marketing, PT-BR, imagem, 1 variável de nome, 2 botões). Ajustes sugeridos antes de enviar:
- Botão "Nao, obrigado" → **"Não, obrigado"** (acento).
- Trocar "->" por "→" ou "por" (fica mais limpo no celular).
- Variável `{{1}}`: preencher o exemplo com um nome (ex.: "Lucas"), senão a Meta pode recusar.
- O nome contém "openarvoredo", então o CRM reconhece o produto automaticamente (passo 2).

## 2. Cadastro no CRM
- Criar o empreendimento **Open Arvoredo** no segmento **S4 - MCMV** (mesmo do Open Bosque e Open Major).
- Ligar à Roleta (lista de campanhas), para leads de anúncio/site irem aos corretores do S4 normalmente. Não entra na Fila CEO obrigatória.
- Reconhecer o modelo: quem responder "Sim, quero conhecer" ao disparo `openarvoredo_*` é reativado com o produto **Open Arvoredo** (não Open Bosque) e cai na Fila CEO, como os outros disparos.
- Nada muda nos outros empreendimentos.

## 3. Validação
- Conferir que aparece nas listas de empreendimento (Pipeline, Foco Corretores, Central de Reengajamento).
- Lead de teste com campanha "Open Arvoredo": confirmar produto correto; apagar o teste no fim.

## Detalhes técnicos
- Dados (sem migração): insert em `empreendimentos_canonicos` (segmento S4 `9948f523-…` conferir id), `empreendimento_aliases` ("open arvoredo", "openarvoredo", "open_arvoredo") e `roleta_campanhas` (empreendimento "Open Arvoredo", segmento S4).
- Código: regra `openarvoredo|open_arvoredo|open arvoredo` → "Open Arvoredo" em `src/lib/reengajamentoEmpreendimento.ts` e `supabase/functions/whatsapp-webhook/index.ts` (antes da regra do Open Bosque); redeploy do webhook.
- Opcional: imagem do disparo em `DisparoCustomizadoCard.tsx` se você enviar a arte.
