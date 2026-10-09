# Modelo convitesabado_openoutlet0910 (Open Bosque): validar e deixar pronto

## O que conferi
- Pelo seu último print, a Meta já **aprovou** o modelo (Ativo).
- Os 3 botões são reconhecidos: "Sim, quero ir de manhã" e "Sim, quero ir de tarde" contam como **Sim**; "Não tenho interesse" conta como **Não**.
- **Problema encontrado:** o nome do modelo tem "openoutlet", não "openbosque". Hoje o sistema não reconheceria o produto: quem responder "Sim" entraria **sem Open Bosque** na Fila do CEO e a roleta não mandaria para os corretores do Open.
- A arte ainda não está ligada ao modelo (a foto viria vazia).

## O que vou fazer
1. Fazer o sistema reconhecer "openoutlet" como **Open Bosque** (no recebimento da resposta e na Fila do CEO).
2. Salvar a arte (menos de 300 KB) junto das outras artes e ligar ao modelo, para a foto aparecer sozinha no Disparo manual. **Preciso que você me mande o arquivo "Conheça os Decorados Outlet.png"** — o print não serve como arte.
3. O botão escolhido (manhã ou tarde) aparece na linha do tempo do lead ("Cliente respondeu: Sim, quero ir de manhã"), para o corretor saber o turno da visita.
4. Conferir com a Meta status, idioma e botões e abrir a Central para ver modelo e foto, **sem enviar nada**.

Regras mantidas: quem já tem corretor continua com ele e recebe o aviso; quem não tem vai para a Fila do CEO como Open Bosque.

## Detalhes técnicos
- `supabase/functions/whatsapp-webhook/index.ts` (linha 14) e `src/lib/reengajamentoEmpreendimento.ts`: incluir `openoutlet` na regra Open Bosque. Deploy do `whatsapp-webhook`.
- Upload: `campaign-images/reengajamento/convitesabado-openoutlet0910.jpg`; nova entrada em `TEMPLATE_HEADER_IMAGES` (`DisparoCustomizadoCard.tsx`).
- Sem migration.
