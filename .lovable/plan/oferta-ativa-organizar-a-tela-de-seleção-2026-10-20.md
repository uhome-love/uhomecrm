# Oferta Ativa: organizar a tela de seleção

## Minha opinião
Funciona, mas está poluída. Hoje aparecem cerca de 50 empreendimentos misturados, com imóveis avulsos de 1 cliente (como "Apartamento 2 quartos — Passo da Areia (83863-CN)") no mesmo nível dos principais. O corretor perde tempo procurando, e o botão "Começar a ligar" fica escondido lá embaixo.

## O que muda (só visual, nenhuma regra muda)

```text
Para quem você quer ligar hoje?
[ Estagnados 777 ✓ ]  [ Descartados 4.496 ]  [ Listas de leads ]

Escolha o empreendimento                       [ buscar empreendimento... ]
[ Aleatório · 777 ]  (destaque grande)

Principais
[Casa Tua POA 194] [Casa Tua Canoas 169] [Lake Eyre 67] [Connect JW 43]
[Open Bosque 39] [Shift 32] [Terrace 20] [Grand Park Moinhos 19] ...

▸ Outros empreendimentos (24)        ← fechado por padrão
▸ Imóveis avulsos e sem empreendimento (9)   ← fechado por padrão

──────────────────────────────────────────────
Selecionados: Casa Tua POA, Lake Eyre · 261 clientes   [ Começar a ligar ]  (barra fixa)
```

1. **Principais**: empreendimentos com 10 clientes ou mais, em grade organizada (cartões do mesmo tamanho).
2. **Outros empreendimentos**: os com menos de 10, recolhidos num "ver mais".
3. **Imóveis avulsos e sem empreendimento**: imóveis do site com código, "Avulso" e "Sem empreendimento", recolhidos à parte.
4. **Busca** para achar um empreendimento pelo nome.
5. **Barra fixa no rodapé** com o que foi escolhido, total de clientes e o botão "Começar a ligar", sempre visível.
6. **Cartões das 3 portas** mais baixos, para sobrar espaço; "Listas de leads" alinhado aos outros.

## Fora deste ajuste
Contagens, quem entra no Bolsão, reserva de 5 min e resultados continuam iguais.

## Validação
Abrir a Oferta Ativa como corretor, conferir as duas portas (Estagnados e Descartados), testar a busca, selecionar e puxar um cliente, e clicar em "Sair" sem registrar resultado em lead real.

## Detalhes técnicos
- Só `BolsaoDiscador.tsx` (dividir em `EmpreendimentoSeletor.tsx` para não passar de 300 linhas) e `PortasOfertaAtiva.tsx`.
- Agrupamento no cliente: avulso = nome com padrão `(CÓDIGO)`, "Avulso" ou "Sem empreendimento"; principal = total ≥ 10.
- Usar `Collapsible` e `Input` do shadcn e tokens semânticos; nenhuma mudança no banco.
