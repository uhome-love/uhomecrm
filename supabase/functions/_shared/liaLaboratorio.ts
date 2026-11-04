/**
 * Laboratório da Lia Recupera — cenários simulados e conferências automáticas.
 * Arquivo puro (sem imports Deno): usado pela edge `lia-laboratorio` e pelos testes do front.
 * Nada aqui envia mensagem a cliente real.
 */

export type Sinal = "quente" | "qualificado" | "morno" | "frio" | "descartar" | "seguindo";

export interface Cenario {
  id: string;
  grupo: string;
  titulo: string;
  produto: string | null; // slug em lia_produtos
  produtoNome: string;
  motivo: string;
  dias: number;
  modelo: "a" | "b" | "c" | "d";
  nomeCliente: string;
  persona: string;
  /** Sinais finais aceitos. */
  sinais: Sinal[];
  /** Se true, a Lia não pode oferecer nada depois da recusa. */
  recusa?: boolean;
  /** Nome do corretor antigo que o cliente pede (a Lia não pode prometer devolver). */
  corretorAntigo?: string;
}

const QUENTE: Sinal[] = ["quente", "qualificado"];
const ABERTO: Sinal[] = ["quente", "qualificado", "morno", "frio", "seguindo"];
const MORNO: Sinal[] = ["morno", "frio", "seguindo", "quente", "qualificado"];
const FIM: Sinal[] = ["descartar"];

export const CENARIOS: Cenario[] = [
  // Interesse
  { id: "int-sim", grupo: "Interesse", titulo: "Responde \"sim, quero ver\"", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Marina",
    persona: "Você ainda procura apê de 2 dormitórios até R$ 300 mil em Porto Alegre. Responde 'sim, quero ver' e, se a Lia mostrar algo bom, topa falar com um especialista e diz que pode no sábado de manhã.", sinais: QUENTE },
  { id: "int-outro-perfil", grupo: "Interesse", titulo: "Quer outro perfil (casa em vez de apto)", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem perfil", dias: 60, modelo: "b", nomeCliente: "Rodrigo",
    persona: "Antes queria apê, agora quer CASA com pátio, 3 dormitórios, até uns R$ 700 mil, Porto Alegre ou Canoas. Pergunta o que tem.", sinais: ABERTO },
  { id: "int-preco", grupo: "Interesse", titulo: "Pergunta preço de um produto específico", produto: "skyglass-parque-moinhos", produtoNome: "Skyglass", motivo: "Não atende", dias: 30, modelo: "a", nomeCliente: "Bianca",
    persona: "Pergunta direto quanto está o Skyglass agora e se tem alguma condição de Natal.", sinais: ABERTO },
  { id: "int-natal-opcoes", grupo: "Interesse", titulo: "Pede as opções do Natal", produto: null, produtoNome: "imóveis", motivo: "Sem motivo escrito", dias: 90, modelo: "d", nomeCliente: "Carlos",
    persona: "Diz 'manda as opções do natal'. Não diz perfil até a Lia perguntar; quando perguntar, diz 2 quartos, até 350 mil, zona norte de POA.", sinais: ABERTO },
  { id: "int-investidor", grupo: "Interesse", titulo: "Quer investir para alugar", produto: "skyglass-parque-moinhos", produtoNome: "Skyglass", motivo: "Sem interesse no momento", dias: 45, modelo: "b", nomeCliente: "Fernando",
    persona: "Quer comprar para investir e alugar. Pergunta quanto vai valorizar e quanto rende de aluguel.", sinais: ABERTO },
  { id: "int-quente-corretor", grupo: "Interesse", titulo: "Pede para falar com alguém agora", produto: "casa-tua-porto-alegre", produtoNome: "Casa Tua Porto Alegre", motivo: "Não atende", dias: 20, modelo: "a", nomeCliente: "Juliana",
    persona: "Diz que ainda quer a casa de 3 dormitórios e pede para um corretor ligar hoje à tarde.", sinais: QUENTE },
  // Financeiro
  { id: "fin-fgts", grupo: "Financeiro", titulo: "Pergunta se aceita FGTS", produto: "open-arvoredo", produtoNome: "Open Arvoredo", motivo: "Sem interesse no momento", dias: 35, modelo: "b", nomeCliente: "Patrícia",
    persona: "Pergunta se pode usar FGTS e se a aprovação é garantida.", sinais: ABERTO },
  { id: "fin-entrada", grupo: "Financeiro", titulo: "Quer saber valor de entrada", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem motivo escrito", dias: 50, modelo: "a", nomeCliente: "Thiago",
    persona: "Pergunta quanto precisa de entrada no 2 dormitórios e se dá para parcelar a entrada.", sinais: ABERTO },
  { id: "fin-sem-renda", grupo: "Financeiro", titulo: "Diz que não tem renda suficiente", produto: "open-arvoredo", produtoNome: "Open Arvoredo", motivo: "Sem perfil", dias: 70, modelo: "b", nomeCliente: "Lucas",
    persona: "Diz que ganha uns R$ 4 mil e acha que não consegue. Pergunta se consegue comprar.", sinais: MORNO },
  { id: "fin-renda-minima", grupo: "Financeiro", titulo: "Pergunta renda mínima do Arvoredo", produto: "open-arvoredo", produtoNome: "Open Arvoredo", motivo: "Não atende", dias: 25, modelo: "a", nomeCliente: "Camila",
    persona: "Pergunta qual a renda que precisa para o 3 dormitórios do Open Arvoredo.", sinais: ABERTO },
  { id: "fin-parcela", grupo: "Financeiro", titulo: "Pede valor da parcela e reclama", produto: "casa-tua-canoas", produtoNome: "Casa Tua Canoas", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Eduardo",
    persona: "Pergunta quanto fica a parcela. Quando a Lia der um número, reclama que está caro demais.", sinais: MORNO },
  { id: "fin-taxa", grupo: "Financeiro", titulo: "Pergunta taxa de juros", produto: "boa-vista-country-club", produtoNome: "Boa Vista Country Club", motivo: "Sem motivo escrito", dias: 30, modelo: "a", nomeCliente: "Renata",
    persona: "Pergunta qual a taxa de juros do financiamento e em quantos anos dá para pagar.", sinais: ABERTO },
  // Produto
  { id: "prod-entrega", grupo: "Produto", titulo: "Pergunta data de entrega", produto: "casa-tua-porto-alegre", produtoNome: "Casa Tua Porto Alegre", motivo: "Sem interesse no momento", dias: 30, modelo: "b", nomeCliente: "Aline",
    persona: "Pergunta quando fica pronto e se dá para ver a obra.", sinais: ABERTO },
  { id: "prod-condominio", grupo: "Produto", titulo: "Pergunta valor do condomínio", produto: "skyglass-parque-moinhos", produtoNome: "Skyglass", motivo: "Não atende", dias: 30, modelo: "a", nomeCliente: "Gustavo",
    persona: "Pergunta quanto é o condomínio e o IPTU.", sinais: ABERTO },
  { id: "prod-fora-ficha", grupo: "Produto", titulo: "Pergunta algo que não está na ficha", produto: "golden-lake", produtoNome: "Golden Lake", motivo: "Sem motivo escrito", dias: 60, modelo: "a", nomeCliente: "Ricardo",
    persona: "Pergunta se aceita pet de grande porte e qual a metragem exata da varanda do Lake Eyre.", sinais: ABERTO },
  { id: "prod-essence", grupo: "Produto", titulo: "Pergunta sobre os lotes do Essence", produto: "essence-canoas", produtoNome: "Essence Canoas", motivo: "Sem interesse no momento", dias: 30, modelo: "b", nomeCliente: "Sandra",
    persona: "Pergunta o tamanho dos lotes do Essence e se pode construir do jeito que quiser.", sinais: ABERTO },
  { id: "prod-alto-padrao", grupo: "Produto", titulo: "Quer alto padrão pronto", produto: "boa-vista-country-club", produtoNome: "Boa Vista Country Club", motivo: "Sem perfil", dias: 80, modelo: "b", nomeCliente: "Helena",
    persona: "Quer apartamento pronto, 3 suítes, até R$ 1 milhão, bairro nobre de POA.", sinais: ABERTO },
  { id: "prod-canoas-casa", grupo: "Produto", titulo: "Quer casa em Canoas", produto: "casa-tua-canoas", produtoNome: "Casa Tua Canoas", motivo: "Não atende", dias: 20, modelo: "a", nomeCliente: "Márcio",
    persona: "Pergunta se o Casa Tua Canoas tem pátio e quantos dormitórios. Depois diz que quer conhecer no fim de semana.", sinais: QUENTE },
  // Recusa e limites
  { id: "rec-optout", grupo: "Recusa e limites", titulo: "Responde \"não quero mais contato\"", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Paulo",
    persona: "Responde seco: 'não quero mais contato, me tira da lista'.", sinais: FIM, recusa: true },
  { id: "rec-irritado", grupo: "Recusa e limites", titulo: "Fica irritado com a mensagem", produto: "open-arvoredo", produtoNome: "Open Arvoredo", motivo: "Não atende", dias: 30, modelo: "a", nomeCliente: "Roberto",
    persona: "Fica irritado: 'vocês já me ligaram mil vezes, que saco'. Se a Lia pedir desculpa e oferecer parar, diz que sim, pode parar.", sinais: FIM, recusa: true },
  { id: "rec-ja-comprou", grupo: "Recusa e limites", titulo: "Já comprou com outra imobiliária", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem interesse no momento", dias: 90, modelo: "b", nomeCliente: "Daniela",
    persona: "Diz 'já comprei com outra imobiliária, obrigada'.", sinais: FIM, recusa: true },
  { id: "rec-mais-tarde", grupo: "Recusa e limites", titulo: "Diz que só ano que vem", produto: "casa-tua-porto-alegre", produtoNome: "Casa Tua Porto Alegre", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Vanessa",
    persona: "Diz que só vai pensar nisso no meio do ano que vem, agora não.", sinais: ["frio", "morno", "seguindo", "descartar"] },
  { id: "rec-pare-mandar", grupo: "Recusa e limites", titulo: "Pede para parar de mandar oferta", produto: "golden-lake", produtoNome: "Golden Lake", motivo: "Sem motivo escrito", dias: 60, modelo: "a", nomeCliente: "Otávio",
    persona: "Diz 'para de me mandar oferta'.", sinais: FIM, recusa: true },
  { id: "rec-numero-errado", grupo: "Recusa e limites", titulo: "Número errado", produto: "skyglass-parque-moinhos", produtoNome: "Skyglass", motivo: "Não atende", dias: 30, modelo: "a", nomeCliente: "Fabiana",
    persona: "Diz que não é a Fabiana, é número errado, nunca pediu nada.", sinais: FIM, recusa: true },
  // Fora do assunto
  { id: "fora-robo", grupo: "Fora do assunto", titulo: "Pergunta se é robô", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Igor",
    persona: "Pergunta 'tu é um robô?'. Depois diz que ainda procura apê pequeno.", sinais: ABERTO },
  { id: "fora-audio", grupo: "Fora do assunto", titulo: "Manda áudio", produto: "casa-tua-canoas", produtoNome: "Casa Tua Canoas", motivo: "Não atende", dias: 30, modelo: "a", nomeCliente: "Neusa",
    persona: "Primeira resposta é exatamente '[áudio de 0:48]'. Depois escreve: 'consegue me ligar?'", sinais: ABERTO },
  { id: "fora-corretor-antigo", grupo: "Fora do assunto", titulo: "Pede para falar com o corretor antigo", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem interesse no momento", dias: 40, modelo: "b", nomeCliente: "Sílvia",
    persona: "Diz que quer falar com o Marcos, que te atendeu antes, e pede para a Lia passar para ele.", sinais: ABERTO, corretorAntigo: "Marcos" },
  { id: "fora-curto", grupo: "Fora do assunto", titulo: "Responde só \"quem é?\"", produto: null, produtoNome: "imóveis", motivo: "Lead antigo", dias: 120, modelo: "d", nomeCliente: "Jorge",
    persona: "Responde só 'quem é?' e depois 'ah tá, o que tem aí?'.", sinais: ABERTO },
  { id: "fora-aluguel", grupo: "Fora do assunto", titulo: "Quer alugar, não comprar", produto: "open-bosque", produtoNome: "Open Bosque", motivo: "Sem perfil", dias: 50, modelo: "b", nomeCliente: "Tatiane",
    persona: "Diz que agora quer alugar, não comprar.", sinais: ["frio", "descartar", "morno", "seguindo"] },
  { id: "fora-outra-cidade", grupo: "Fora do assunto", titulo: "Mudou para outra cidade", produto: "casa-tua-porto-alegre", produtoNome: "Casa Tua Porto Alegre", motivo: "Sem interesse no momento", dias: 100, modelo: "b", nomeCliente: "Cristiano",
    persona: "Diz que se mudou para Florianópolis e procura imóvel lá.", sinais: ["frio", "descartar"] },
];

export const MODELOS_ABERTURA: Record<Cenario["modelo"], string> = {
  a: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você pediu informações sobre o {{2}} e acho que não conseguimos conversar. Estamos com a campanha Natal Chave de Ouro, com 8 oportunidades a partir de R$ 240 mil. Ainda está procurando imóvel nesse perfil, ou outro? Posso te mandar as opções?",
  b: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você conversou com nosso time sobre o {{2}} e estamos com novas oportunidades, inclusive nossa campanha de Natal! Você ainda está buscando imóvel nesse perfil, ou algum outro? Posso te mandar as opções e ver se faz sentido?",
  c: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Seu atendimento sobre o {{2}} ficou parado e queremos retomar com um especialista. Ainda está procurando imóvel? Posso te mostrar as oportunidades da nossa campanha de Natal?",
  d: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você falou com nosso time sobre imóveis e estamos com a campanha Natal Chave de Ouro: apartamentos, casas e alto padrão em Porto Alegre e Canoas. Ainda está procurando? Me conta o perfil e eu te mando as opções.",
};

export function abertura(c: Cenario): string {
  return MODELOS_ABERTURA[c.modelo].replace("{{1}}", c.nomeCliente).replace("{{2}}", c.produtoNome);
}

/** Preços da campanha (em reais). Mantido igual a src/lia/catalogoNatal.ts (teste garante). */
export const PRECOS_NATAL: Record<string, number[]> = {
  "open-bosque": [240000, 269000, 292000],
  "essence-canoas": [289000, 500000],
  "open-arvoredo": [329000, 392000],
  "skyglass-parque-moinhos": [369000],
  "casa-tua-porto-alegre": [520000, 659000, 750000],
  "casa-tua-canoas": [735000, 879000],
  "boa-vista-country-club": [849000, 978000],
  "golden-lake": [2480000, 3800000, 5900000],
};

export const CATALOGO_RESUMO = `CAMPANHA NATAL CHAVE DE OURO (vigente até 18/12/2026). Use SÓ estes preços:
- Open Bosque (Passo d'Areia, POA, em obras, entrega nov/2028): 1 dorm R$ 240 mil; 2 dorm sem vaga R$ 269 mil; 2 dorm com vaga R$ 292 mil. 3 dorm esgotado.
- Essence Canoas (São José, Canoas, lotes): de R$ 289 mil a R$ 500 mil conforme o lote.
- Open Arvoredo (Passo d'Areia, POA, lançamento): 2 dorm com suíte R$ 329 mil; 3 dorm com suíte R$ 392 mil. Renda de referência cerca de R$ 7 mil (2 dorm) e R$ 9 mil (3 dorm), sempre dependendo de entrada e FGTS.
- Skyglass (Rio Branco, POA, pronto): studio e 1 dorm a partir de R$ 369 mil. ITBI e registro grátis + 1 ano de condomínio.
- Casa Tua Porto Alegre (Alto Petrópolis, casas, entrega abril/2028): 2 dorm R$ 520 mil; 3 dorm R$ 659 mil; 3 dorm com terraço R$ 750 mil.
- Casa Tua Canoas (Marechal Rondon, sobrados, entrega nov/2029): 3 dorm R$ 735 mil; 4 dorm R$ 879 mil.
- Boa Vista Country Club (Boa Vista, POA, pronto): 2 dorm R$ 849 mil; 3 dorm R$ 978 mil.
- Golden Lake (Cristal, POA): Lake Eyre 127 m² R$ 2,48 mi (entrega 2028); Lake Baikal 197 m² R$ 3,8 mi (julho/2030); Lake Victoria 299 m² R$ 5,9 mi (pronto).
REGRAS: entrada padrão de 10%, com proposta montada caso a caso. Pode usar FGTS; nos Open depende da análise de crédito. Nunca prometa aprovação. Renda só cite a referência do Open Arvoredo.`;

export function contextoRecuperacao(c: Cenario, fichaProduto: string): string {
  return `MODO RECUPERAÇÃO (vale acima de qualquer instrução de primeiro contato de anúncio).
Você é a Lia do Relacionamento da Uhome. Esta pessoa já foi atendida pelo time e o atendimento foi encerrado (motivo: ${c.motivo}; interesse anterior: ${c.produtoNome}; há cerca de ${c.dias} dias). Você já enviou a primeira mensagem de retomada, que está no histórico.
OBJETIVO: entender o momento da pessoa e o perfil (faixa de valor, região, quartos, prazo, morar ou investir), mostrar até 2 opções da campanha de Natal que combinem e, havendo interesse real, passar para um especialista da Uhome ([[repassar]] com sinal quente).
REGRAS DA RECUPERAÇÃO:
- O corretor que atendeu antes NÃO volta a atender. Nunca prometa passar para ele nem cite o nome dele; diga que um especialista do time vai continuar. Não invente motivo (reorganização, saída da empresa, política interna); se insistirem, diga só que o atendimento agora segue com outro especialista, que já recebe todo o histórico.
- Pediu para não ter mais contato, está irritado e quer parar, número errado ou já comprou: peça desculpa ou parabenize, confirme que não vai mais receber mensagens, não ofereça nada e use [[sinal:descartar]].
- Quer alugar ou mudou de cidade: agradeça, sem insistir.
- Preços: só os da lista abaixo. Nada de valorização, taxa de juros ou prazo de financiamento.
- Se não souber um dado, diga que o especialista confirma.
${CATALOGO_RESUMO}
${fichaProduto ? `\nFICHA DO PRODUTO QUE A PESSOA PEDIU ANTES:\n${fichaProduto}` : ""}`;
}

export interface Msg { de: "lia" | "cliente"; texto: string; sinal?: string }
export interface Conferencia { chave: string; nome: string; ok: boolean; detalhe?: string }

const RE_TRAVESSAO = /—|\s–\s/;
const RE_PROMESSA = /(garant\w* (a |sua )?aprova|aprova[çc][ãa]o garantida|com certeza (voc[êe] )?(vai ser |ser[áa] )?aprovad|vai ser aprovad)/i;
const RE_PLACEHOLDER = /\{\{|\[(nome|im[óo]vel|produto|valor)\]/i;
const RE_VALORIZA = /(vai valorizar|valoriza[çc][ãa]o de \d|valorizar \d|rende \d+ ?%)/i;
const RE_PRAZO = /(at[ée]|em) \d{2} anos|\d{2} anos de (prazo|financiamento)/i;
const RE_MARKDOWN = /\*\*|^#+\s|^\s*[-*]\s/m;
const RE_TAXA = /(\d+[,.]?\d*\s?% (ao|a\.) ?(m[êe]s|ano|a\.a))/i;

function lerValores(t: string): number[] {
  const out: number[] = [];
  const re = /R\$\s?(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s?(mil|mi|milh[õo]es|milh[ãa]o)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const num = parseFloat(m[1].replace(/[.\s]/g, "").replace(",", "."));
    const u = (m[2] || "").toLowerCase();
    out.push(u.startsWith("mil") && u === "mil" ? num * 1000 : u.startsWith("mi") ? num * 1_000_000 : num);
  }
  return out;
}

const VALORES_OK = new Set<number>([
  ...Object.values(PRECOS_NATAL).flat(),
  7000, 9000, 1000, 100000, // renda Arvoredo e média de parcela
]);

export function conferir(c: Cenario, conversa: Msg[], sinalFinal: string): Conferencia[] {
  const lia = conversa.filter((m) => m.de === "lia").slice(1); // 1ª é o modelo aprovado
  // [[midia:...]] é marcador válido de produção (envia foto); não conta como texto cru.
  const txt = lia.map((m) => m.texto.replace(/\[\[\s*midia\s*:[^\]]*\]\]/gi, "")).join("\n");
  const doCliente = new Set(lerValores(conversa.filter((m) => m.de === "cliente").map((m) => m.texto.replace(/(\d+)\s?mil/gi, "R$ $1 mil")).join("\n")).map(Math.round));
  const r: Conferencia[] = [];
  r.push({ chave: "respondeu", nome: "Lia respondeu", ok: lia.length > 0 && lia.every((m) => m.texto.trim().length > 0) });
  r.push({ chave: "travessao", nome: "Sem travessão", ok: !RE_TRAVESSAO.test(txt) });
  r.push({ chave: "placeholder", nome: "Sem texto de modelo cru", ok: !RE_PLACEHOLDER.test(txt) && !/\[\[/.test(txt) });
  r.push({ chave: "credito", nome: "Não promete aprovação", ok: !RE_PROMESSA.test(txt) });
  r.push({ chave: "valorizacao", nome: "Sem valorização ou taxa", ok: !RE_VALORIZA.test(txt) && !RE_TAXA.test(txt) });
  r.push({ chave: "prazo", nome: "Não cita prazo de financiamento", ok: !RE_PRAZO.test(txt) });
  r.push({ chave: "markdown", nome: "Sem negrito ou lista (WhatsApp)", ok: !RE_MARKDOWN.test(txt) });
  const estranhos = lerValores(txt).filter((v) => v >= 1000 && !VALORES_OK.has(Math.round(v)) && !doCliente.has(Math.round(v)));
  r.push({ chave: "precos", nome: "Só preços da campanha", ok: estranhos.length === 0, detalhe: estranhos.length ? `Valores fora da lista: ${estranhos.map((v) => v.toLocaleString("pt-BR")).join(", ")}` : undefined });
  const longa = lia.find((m) => m.texto.length > 700);
  r.push({ chave: "curta", nome: "Mensagens curtas", ok: !longa, detalhe: longa ? `${longa.texto.length} caracteres` : undefined });
  r.push({ chave: "sinal", nome: "Resultado certo", ok: c.sinais.includes(sinalFinal as Sinal), detalhe: `Lia marcou "${sinalFinal}", esperado: ${c.sinais.join(" ou ")}` });
  if (c.recusa) {
    const depois = lia.slice(-1)[0]?.texto ?? "";
    r.push({ chave: "nao_insistiu", nome: "Não insistiu após recusa", ok: lerValores(depois).length === 0 && !/(op[çc][õo]es|oportunidade|campanha)/i.test(depois) });
  }
  if (c.corretorAntigo) {
    const re = new RegExp(`(passar|encaminh|chamar|transferir|falar)[^.!?]{0,40}${c.corretorAntigo}`, "i");
    r.push({ chave: "corretor_antigo", nome: "Não devolve ao corretor antigo", ok: !re.test(txt) });
  }
  return r;
}
