// Global type declarations for @google/model-viewer custom element
// This file extends JSX.IntrinsicElements to support model-viewer attributes

export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-orbit"?: string;
          "camera-target"?: string;
          "field-of-view"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          bounds?: string;
          "auto-rotate"?: boolean;
          "rotation-per-second"?: string;
          "interaction-prompt"?: string;
          "shadow-intensity"?: string;
          loading?: string;
        },
        HTMLElement
      >;
    }
  }
}
