export class IpcRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IpcRequestError";
    this.code = code;
  }
}

export function invalidPayload(message = "Invalid request payload.") {
  return new IpcRequestError("INVALID_PAYLOAD", message);
}

export function workspaceRequired() {
  return new IpcRequestError(
    "WORKSPACE_REQUIRED",
    "Open a workspace before using this action."
  );
}

export function saveFailed(message: string) {
  return new IpcRequestError("SAVE_FAILED", message);
}

export function exportFailed(message: string) {
  return new IpcRequestError("EXPORT_FAILED", message);
}
