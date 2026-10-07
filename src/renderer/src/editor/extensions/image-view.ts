import { imageSchema } from "@milkdown/kit/preset/commonmark";
import { $view } from "@milkdown/kit/utils";

type ImageViewOptions = {
  workspacePath: string | null;
  notePath: string;
};

export function createImageView(options: ImageViewOptions) {
  return $view(imageSchema.node, () => (initialNode) => {
    const dom = document.createElement("span");
    const image = document.createElement("img");
    let node = initialNode;

    dom.className = "inknest-image-node";
    dom.contentEditable = "false";
    dom.append(image);

    function render() {
      const markdownSrc = String(node.attrs.src ?? "");
      const alt = String(node.attrs.alt ?? "");

      dom.classList.remove("inknest-image-node-broken", "broken-image-placeholder");
      dom.removeAttribute("data-error-label");
      image.hidden = false;
      image.alt = alt;
      image.title = String(node.attrs.title ?? "");
      image.setAttribute("data-markdown-src", markdownSrc);
      image.src = resolveImageDisplaySrc(markdownSrc, options);
    }

    image.addEventListener("error", () => {
      image.hidden = true;
      dom.classList.add("inknest-image-node-broken", "broken-image-placeholder");
      dom.dataset.errorLabel = `Missing image: ${image.alt || image.dataset.markdownSrc || "Image"}`;
    });

    render();

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type !== node.type) {
          return false;
        }

        node = updatedNode;
        render();
        return true;
      },
      ignoreMutation: () => true
    };
  });
}

function resolveImageDisplaySrc(src: string, options: ImageViewOptions) {
  if (/^(?:data:|https?:|file:|blob:)/i.test(src) || src.startsWith("/")) {
    return src;
  }

  if (!options.workspacePath || !isSafeWorkspaceRelativePath(src, options.notePath)) {
    return src;
  }

  const workspaceUrl = `${workspacePathToFileUrl(options.workspacePath)}/`;
  const noteDirectory = options.notePath.split(/[\\/]/).slice(0, -1).join("/");

  return new URL(encodeURI(src), `${workspaceUrl}${encodeURI(noteDirectory)}/`).toString();
}

function isSafeWorkspaceRelativePath(src: string, notePath: string) {
  const segments = [
    ...notePath.split(/[\\/]/).slice(0, -1),
    ...src.split(/[\\/]/)
  ];
  let depth = 0;

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    depth += segment === ".." ? -1 : 1;
    if (depth < 0) {
      return false;
    }
  }

  return true;
}

function workspacePathToFileUrl(workspacePath: string) {
  const normalizedPath = workspacePath.replace(/\\/g, "/").replace(/\/+$/g, "");
  const pathWithLeadingSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return `file://${encodeURI(pathWithLeadingSlash)}`;
}
