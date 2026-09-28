// Conteúdo da página pública /v/casa-tua-canoas.
// Regras: sem preço, tabela ou planta; nunca usar o termo "área privativa".

export const LANDING_SLUG = "casa-tua-canoas";
export const YOUTUBE_ID = "PovnF-uY58k"; // filme institucional (não usado na página; vídeo atual = tour vertical)

/** Lista ÚNICA de fotos da galeria (renders oficiais servidos em /casatua/).
 *  `src` vazio = card placeholder com legenda. Nunca incluir plantas. */
export const GALERIA: { legenda: string; src?: string }[] = [
  { legenda: "Fachada", src: "/casatua/casa.jpg" },
  { legenda: "Piscinas", src: "/casatua/club.jpg" },
  { legenda: "Club House", src: "/casatua/invest.jpg" },
  { legenda: "Salão de festas", src: "/casatua/salao.jpg" },
  { legenda: "Academia", src: "/casatua/academia.jpg" },
];

export const CHIPS = ["3 e 4 dormitórios", "Suíte", "Terraço", "Espaço p/ piscina", "2 vagas", "157 a 170 m²"];

export const LAZER = [
  "Piscinas adulto e infantil",
  "Academia",
  "Brinquedoteca",
  "Pet place",
  "Recanto da fogueira",
  "Salão de festas",
];

export const PROXIMIDADES = [
  "ParkShopping Canoas",
  "Universidade La Salle",
  "Parque Getúlio Vargas",
  "Hospital N. Sra. das Graças",
];

export type QuizKey = "quem" | "quando" | "peso";
export const QUIZ: { key: QuizKey; pergunta: string; opcoes: { value: string; label: string }[] }[] = [
  {
    key: "quem",
    pergunta: "A casa é pra quem?",
    opcoes: [
      { value: "casal", label: "Casal" },
      { value: "familia_filhos", label: "Família com filhos" },
      { value: "familia_pets", label: "Família + pets" },
      { value: "so_eu", label: "Só eu" },
    ],
  },
  {
    key: "quando",
    pergunta: "Quando pensa em se mudar?",
    opcoes: [
      { value: "quanto_antes", label: "O quanto antes" },
      { value: "ate_1_ano", label: "Em até 1 ano" },
      { value: "pesquisando", label: "Só pesquisando" },
    ],
  },
  {
    key: "peso",
    pergunta: "O que mais pesa na escolha?",
    opcoes: [
      { value: "patio_espaco", label: "Pátio / espaço" },
      { value: "seguranca", label: "Segurança" },
      { value: "localizacao", label: "Localização" },
      { value: "lazer", label: "Lazer do condomínio" },
    ],
  },
];

export const HORARIOS = [
  { value: "sabado_manha", label: "Sábado de manhã" },
  { value: "sabado_tarde", label: "Sábado à tarde" },
  { value: "domingo", label: "Domingo" },
  { value: "dia_semana", label: "Dia de semana" },
] as const;
