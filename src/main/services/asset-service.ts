import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SavedImageAsset } from "../../shared/ipc";
import { invalidPayload } from "../ipc/errors";
import {
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "./path-utils";
import { workspaceAssetsFolderName } from "./folder-service";

const defaultImageName = "pasted-image.png";
const imageExtensionByMimeType: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "image/bmp": ".bmp"
};

export async function createAvailableAssetFileName(
  workspaceRoot: string,
  originalName: string
) {
  const assetDirectory = resolveInsideWorkspace(
    workspaceRoot,
    workspaceAssetsFolderName
  );
  await mkdir(assetDirectory, { recursive: true });

  const sanitizedName = sanitizeFileName(path.basename(originalName));
  const parsedName = path.parse(sanitizedName);
  const baseName = sanitizeFileName(parsedName.name);
  const extension = parsedName.ext.toLowerCase();
  let candidate = `${baseName || "image"}${extension}`;
  let counter = 2;

  while (await pathExists(path.join(assetDirectory, candidate))) {
    candidate = `${baseName || "image"} ${counter}${extension}`;
    counter += 1;
  }

  return candidate;
}

export async function copyImageAsset(
  workspaceRoot: string,
  sourcePath: string
): Promise<SavedImageAsset> {
  const fileName = await createAvailableAssetFileName(
    workspaceRoot,
    path.basename(sourcePath)
  );
  const assetPath = resolveInsideWorkspace(
    workspaceRoot,
    path.join(workspaceAssetsFolderName, fileName)
  );

  await copyFile(sourcePath, assetPath);

  return createSavedImageAsset(workspaceRoot, assetPath, fileName);
}

export async function saveImageAsset(
  workspaceRoot: string,
  bytes: number[] | Uint8Array,
  fileName?: string,
  mimeType?: string
): Promise<SavedImageAsset> {
  if (bytes.length === 0) {
    throw invalidPayload("Image data cannot be empty.");
  }

  const requestedName = fileName?.trim() || defaultImageName;
  const nameWithExtension = ensureImageExtension(requestedName, mimeType);
  const assetFileName = await createAvailableAssetFileName(
    workspaceRoot,
    nameWithExtension
  );
  const assetPath = resolveInsideWorkspace(
    workspaceRoot,
    path.join(workspaceAssetsFolderName, assetFileName)
  );

  await writeFile(assetPath, Buffer.from(bytes), { flag: "wx" });

  return createSavedImageAsset(workspaceRoot, assetPath, assetFileName);
}

function ensureImageExtension(fileName: string, mimeType?: string) {
  const parsedName = path.parse(fileName);

  if (parsedName.ext) {
    return fileName;
  }

  return `${fileName}${imageExtensionByMimeType[mimeType ?? ""] ?? ".png"}`;
}

function createSavedImageAsset(
  workspaceRoot: string,
  absoluteAssetPath: string,
  fileName: string
): SavedImageAsset {
  return {
    assetPath: toWorkspaceRelativePath(workspaceRoot, absoluteAssetPath),
    displaySrc: pathToFileURL(absoluteAssetPath).toString(),
    fileName
  };
}

async function pathExists(candidatePath: string) {
  try {
    await stat(candidatePath);
    return true;
  } catch {
    return false;
  }
}
