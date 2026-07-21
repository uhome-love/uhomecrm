/**
 * Escala canônica de z-index do CRM.
 *
 * Antes desta escala, cada componente escolhia um valor solto (z-40, zIndex:35,
 * 99999 inline) — o que provocava sobreposições esquisitas (ex.: header sticky
 * do Pipeline em z-40 e drawer do lead também em z-40, permitindo o header
 * vazar por cima do drawer em alguns navegadores).
 *
 * Regra: consumir SEMPRE via esta constante em qualquer overlay/sticky novo.
 * Radix Dialog/Popover usam z-50 nativo — a escala está montada para conviver
 * com isso (drawer > 50; modais focus > 50 também).
 */
export const Z = {
  /** Header sticky do Pipeline e tabs mobile — abaixo de qualquer overlay. */
  headerSticky: 30,
  /** Tabs do PipelineMobileView (sticky dentro do container do pipeline). */
  mobileTabs: 25,
  /** Popovers de hover do card do pipeline. */
  cardHover: 45,
  /** Drawer lateral do lead — precisa cobrir o header sticky. */
  drawer: 50,
  /** Painel HOMI dentro do drawer. */
  drawerHomiPanel: 55,
  /** Overlays de foco (WhatsApp / Call) — modais dedicados full-screen. */
  focusOverlay: 70,
  focusOverlayContent: 71,
  /** Toasts / alertas globais. */
  toast: 90,
} as const;

export type ZKey = keyof typeof Z;
