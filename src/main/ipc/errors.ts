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
