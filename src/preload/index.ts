import { contextBridge } from "electron";
import type { InkNestApi } from "../shared/preload";

const inknestApi: InkNestApi = {
  getAppInfo: () => ({
    name: "InkNest",
    phase: "phase-1-shell"
  })
};

contextBridge.exposeInMainWorld("inknest", inknestApi);
