export const codeLanguages: Array<[string, string, ...string[]]> = [
  ["", "Plain text", "text", "txt"],
  ["javascript", "JavaScript", "js"], ["typescript", "TypeScript", "ts"],
  ["jsx", "JSX"], ["tsx", "TSX"], ["html", "HTML"], ["css", "CSS"],
  ["scss", "SCSS", "sass"], ["less", "Less"], ["json", "JSON"],
  ["yaml", "YAML", "yml"], ["xml", "XML"], ["markdown", "Markdown", "md"],
  ["python", "Python", "py"], ["bash", "Bash"], ["sh", "Shell", "shell script"],
  ["powershell", "PowerShell", "ps1"], ["c", "C"], ["cpp", "C++", "cxx"],
  ["csharp", "C#", "cs", "c sharp"], ["java", "Java"], ["kotlin", "Kotlin", "kt"],
  ["swift", "Swift"], ["go", "Go", "golang"], ["rust", "Rust", "rs"],
  ["ruby", "Ruby", "rb"], ["php", "PHP"], ["sql", "SQL"], ["r", "R"],
  ["lua", "Lua"], ["dart", "Dart"], ["scala", "Scala"], ["perl", "Perl", "pl"],
  ["elixir", "Elixir", "ex"], ["erlang", "Erlang", "erl"], ["clojure", "Clojure", "clj"],
  ["haskell", "Haskell", "hs"], ["fsharp", "F#", "fs"], ["matlab", "MATLAB"],
  ["graphql", "GraphQL", "gql"], ["dockerfile", "Dockerfile", "docker"],
  ["makefile", "Makefile", "make"], ["toml", "TOML"], ["ini", "INI"],
  ["protobuf", "Protocol Buffers", "proto"], ["latex", "LaTeX", "tex"]
];

let sequence = 0;
export function createCodeLanguagePicker(options: {
  trigger: HTMLButtonElement;
  getLanguage: () => string;
  isEditable: () => boolean;
  onSelect: (language: string) => void;
}) {
  const { trigger } = options;
  let popup: HTMLDivElement | null = null;
  let search: HTMLInputElement | null = null;
  let list: HTMLDivElement | null = null;
  let choices: typeof codeLanguages = [];
  let selected = 0;
  const id = `code-language-picker-${++sequence}`;
  trigger.type = "button";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "Code block language");

  function close(returnFocus = false) {
    popup?.remove(); popup = null; search = null; list = null;
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-controls");
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("focusin", outside);
    document.removeEventListener("scroll", scroll, true);
    window.removeEventListener("resize", resize);
    if (returnFocus && trigger.isConnected) trigger.focus();
  }
  function outside(event: Event) {
    if (event.target instanceof Node && (popup?.contains(event.target) || trigger.contains(event.target))) return;
    close();
  }
  function scroll(event: Event) {
    if (event.target instanceof Node && popup?.contains(event.target)) return;
    close();
  }
  function resize() { close(); }
  function choose(index: number) {
    if (!options.isEditable() || !choices[index]) return;
    const language = choices[index][0];
    close();
    options.onSelect(language);
    trigger.focus();
  }
  function highlight() {
    if (!list || !search) return;
    const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
    buttons.forEach((button, index) => button.setAttribute("aria-selected", String(index === selected)));
    if (buttons[selected]) {
      search.setAttribute("aria-activedescendant", buttons[selected].id);
      buttons[selected].scrollIntoView({ block: "nearest" });
    } else search.removeAttribute("aria-activedescendant");
  }
  function render() {
    if (!list || !search) return;
    const current = options.getLanguage();
    const languages = [...codeLanguages];
    if (current && !languages.some(([value]) => value === current)) languages.unshift([current, current]);
    const query = search.value.trim().toLocaleLowerCase();
    choices = languages.filter((language) => language.join(" ").toLocaleLowerCase().includes(query));
    selected = Math.max(0, choices.findIndex(([value]) => value === current));
    list.replaceChildren();
    if (!choices.length) {
      const empty = document.createElement("p");
      empty.className = "code-language-empty";
      empty.textContent = "No matching languages";
      list.append(empty);
    }
    choices.forEach(([value, label], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.id = `${id}-${index}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", label);
      button.dataset.language = value;
      button.textContent = label;
      if (value === current) button.dataset.current = "true";
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("mouseenter", () => { selected = index; highlight(); });
      button.addEventListener("click", () => choose(index));
      list!.append(button);
    });
    highlight();
  }
  function open() {
    if (!options.isEditable() || trigger.disabled) return;
    if (popup) { close(true); return; }
    popup = document.createElement("div");
    popup.className = "code-language-picker";
    popup.style.fontFamily = getComputedStyle(trigger).fontFamily;
    search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search languages…";
    search.setAttribute("aria-label", "Search code languages");
    search.setAttribute("aria-controls", id);
    list = document.createElement("div");
    list.className = "code-language-options";
    list.id = id;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Code languages");
    popup.append(search, list);
    document.body.append(popup);
    const bounds = trigger.getBoundingClientRect();
    popup.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - popup.offsetWidth - 8))}px`;
    popup.style.top = `${Math.max(8, bounds.bottom + popup.offsetHeight + 6 > innerHeight - 8 ? bounds.top - popup.offsetHeight - 6 : bounds.bottom + 6)}px`;
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", id);
    search.addEventListener("input", render);
    popup.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (choices.length) selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
        highlight();
      } else if (event.key === "Enter") { event.preventDefault(); if (choices.length) choose(selected); }
      else if (event.key === "Tab") close();
    });
    search.focus();
    render();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
  }
  trigger.addEventListener("click", open);
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); open(); }
  };
  trigger.addEventListener("keydown", keyboard);
  return {
    refresh() {
      const language = options.getLanguage();
      const label = codeLanguages.find(([value]) => value === language)?.[1] ?? language;
      trigger.textContent = label || "Plain text";
      trigger.dataset.language = language;
      trigger.title = `${label || "Plain text"} — choose code language`;
      trigger.disabled = !options.isEditable();
      if (!options.isEditable()) close();
      else if (popup) render();
    },
    destroy() {
      close();
      trigger.removeEventListener("click", open);
      trigger.removeEventListener("keydown", keyboard);
    }
  };
}
