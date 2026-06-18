/**
 * GERENTES_REAIS — fallback estático dos gerentes (auth_id / profiles.user_id).
 *
 * Fonte de verdade DINÂMICA: useGestoresPipeline (team_members + profiles).
 * Esta constante existe apenas como fallback e para mapas que indexam por id
 * (gestorTheme). Mantida em arquivo isolado para evitar dependência circular
 * entre o hook e o componente Select.
 */
export const GERENTES_REAIS = [
  { id: "fb61ecda-5c4b-49d7-bda7-ccf9b589da07", nome: "Bruno Schuler", apelido: "Bruno" },
  { id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", nome: "Gabriel Vieira", apelido: "Gabriel" },
  { id: "7a270cc1-a457-4a02-8a62-462ba5a98937", nome: "Junior Padilha", apelido: "Junior" },
] as const;
