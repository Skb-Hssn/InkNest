import { app } from "electron";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { updateSettings } from "./settings-store";

export const exampleNotePaths = ["Notes/Ideas worth keeping.md", "Notes/Reading list.md", "Notes/Untitled.md"];
export const getExampleWorkspacePath = () => path.join(app.getPath("userData"), "workspaces", "Personal");

const ideas = `# Ideas worth keeping

A quiet place for useful thoughts, small experiments, and things I want to return to.

## Make room for good ideas

Capture first. Connect later. Keep the ideas that still feel useful tomorrow.

## Small next steps

- [x] Collect notes in one local workspace
- [ ] Turn one idea into a small experiment
- [ ] Review what matters each Friday

> [!NOTE]
> Good notes make thinking easier.

## A simple rhythm

| Practice | When | Purpose |
| --- | --- | --- |
| Capture | Daily | Save the spark |
| Connect | Weekly | Find patterns |

## Build something small

\`\`\`typescript
const ideas = notes.filter(note => note.worthKeeping);
return ideas.map(note => note.title);
\`\`\`

## Let ideas compound

Small gains add up: $(1 + r)^n$.

$$
V_n = V_0(1 + r)^n
$$
`;

/** Seed only a genuinely new installation; existing settings and notes win. */
export async function prepareFirstLaunchWorkspace() {
  try {
    await access(path.join(app.getPath("userData"), "settings.json"));
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
  }
  const root = getExampleWorkspacePath();
  for (const folder of ["Notes", "Projects", "Journal", "Archive"]) await mkdir(path.join(root, folder), { recursive: true });
  const documents: Record<string, string> = {
    [exampleNotePaths[0]]: ideas,
    [exampleNotePaths[1]]: "# Reading list\n\nA little space for books, articles, and ideas to come back to.\n\n- [ ] Add something you would like to read\n",
    [exampleNotePaths[2]]: "",
    "Notes/Daily notes.md": "# Daily notes\n\nWhat is on your mind today?\n",
    "Projects/InkNest roadmap.md": "# InkNest roadmap\n\n- [x] A calm place to write\n- [x] Notes that stay on your computer\n- [ ] Your next idea\n"
  };
  for (const [name, markdown] of Object.entries(documents)) {
    await writeFile(path.join(root, name), markdown, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
  const research = path.join(app.getPath("userData"), "workspaces", "Research");
  await mkdir(research, { recursive: true });
  await updateSettings((settings) => ({ ...settings, fontSize: 14, outlineWidth: 200, lastWorkspacePath: root, recentWorkspaces: [root, research] }));
}
