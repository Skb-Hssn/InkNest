export type AppInfo = {
  name: "InkNest";
  phase: "phase-1-shell";
};

export type InkNestApi = {
  getAppInfo: () => AppInfo;
};
