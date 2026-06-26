import { ipcMain } from "electron";
import type { IpcResult } from "../../shared/ipc";
import { IpcRequestError } from "./errors";

type Handler<T> = (payload: unknown) => Promise<T> | T;

export function registerIpcHandler<T>(channel: string, handler: Handler<T>) {
  ipcMain.handle(channel, async (_event, payload): Promise<IpcResult<T>> => {
    try {
      const data = await handler(payload);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof IpcRequestError) {
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message
          }
        };
      }

      console.error(`IPC handler failed: ${channel}`, error);

      return {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The request could not be completed."
        }
      };
    }
  });
}
