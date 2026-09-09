import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { ipcChannels } from "../shared/ipc";

if (process.env.INKNEST_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.INKNEST_USER_DATA_DIR));
}

if (process.platform === "linux") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("disable-accelerated-video-decode");
  app.commandLine.appendSwitch("disable-accelerated-video-encode");
  app.commandLine.appendSwitch(
    "disable-features",
    "Vulkan,DefaultANGLEVulkan,VulkanFromANGLE,VaapiVideoDecoder,VaapiVideoEncoder"
  );

  if (process.env.DISPLAY) {
    app.commandLine.appendSwitch("ozone-platform", "x11");
  }
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    title: "InkNest",
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#f7f8f6",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const sendWindowState = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ipcChannels.app.windowStateChanged, {
        isMaximized: mainWindow.isMaximized()
      });
    }
  };

  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);

  let closeHandshakeActive = false;
  let closeHandshakeTimer: NodeJS.Timeout | null = null;

  const clearCloseHandshakeTimer = () => {
    if (closeHandshakeTimer) {
      clearTimeout(closeHandshakeTimer);
      closeHandshakeTimer = null;
    }
  };

  const handleCloseReady = (event: Electron.IpcMainEvent) => {
    if (event.sender !== mainWindow.webContents || !closeHandshakeActive) {
      return;
    }

    clearCloseHandshakeTimer();
    closeHandshakeActive = true;
    mainWindow.close();
  };
  const handleCloseCanceled = (event: Electron.IpcMainEvent) => {
    if (event.sender === mainWindow.webContents) {
      clearCloseHandshakeTimer();
      closeHandshakeActive = false;
    }
  };

  ipcMain.on(ipcChannels.app.closeReady, handleCloseReady);
  ipcMain.on(ipcChannels.app.closeCanceled, handleCloseCanceled);

  mainWindow.on("close", (event) => {
    if (closeHandshakeActive) {
      return;
    }

    event.preventDefault();
    closeHandshakeActive = true;
    mainWindow.webContents.send(ipcChannels.app.prepareToClose);
    closeHandshakeTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.destroy();
      }
    }, 5000);
  });

  mainWindow.on("closed", () => {
    clearCloseHandshakeTimer();
    mainWindow.removeListener("maximize", sendWindowState);
    mainWindow.removeListener("unmaximize", sendWindowState);
    ipcMain.removeListener(ipcChannels.app.closeReady, handleCloseReady);
    ipcMain.removeListener(ipcChannels.app.closeCanceled, handleCloseCanceled);
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  void registerIpcHandlers().then(() => {
    createMainWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
