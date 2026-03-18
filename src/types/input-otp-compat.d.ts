/**
 * input-otp type compatibility.
 */
import type { Context, ComponentType } from "react";

declare module "input-otp" {
  export const OTPInput: ComponentType<any>;
  export const OTPInputContext: Context<{
    slots: Array<{ char: string | null; hasFakeCaret: boolean; isActive: boolean }>;
    [key: string]: any;
  }>;
}
