import { shell } from "electron";
import { ipcChannels } from "../../shared/ipc";
import { assertPlainObject, assertSafeExternalUrl } from "./validation";
import { registerIpcHandler } from "./register";

export function registerLinkHandlers() {
  registerIpcHandler<{ opened: true }>(ipcChannels.links.openExternal, async (payload) => {
    assertPlainObject(payload);
    await shell.openExternal(assertSafeExternalUrl(payload.url));

    return {
      opened: true
    };
  });
}
