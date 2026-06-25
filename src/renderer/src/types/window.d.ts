import type { InkNestApi } from "../../../shared/preload";

declare global {
  interface Window {
    inknest: InkNestApi;
  }
}

export {};
