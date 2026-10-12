// Connecting the hosted site to an Ollama on the visitor's own computer.
//
// Browsers only let a website call a program on your computer if that program allows the
// site. Ollama allows the sites listed in its OLLAMA_ORIGINS setting. These helpers work
// out which problem the visitor has and give the exact fix.

export const OLLAMA_SITES = "https://apex.veklom.com,https://*.apexblueprintv4-02.pages.dev";

export function originsValue(): string {
  const here = typeof window !== "undefined" ? window.location.origin : "";
  const covered = here === "https://apex.veklom.com" || /^https:\/\/[\w-]+\.apexblueprintv4-02\.pages\.dev$/.test(here);
  return covered || !here.startsWith("https://") ? OLLAMA_SITES : `${OLLAMA_SITES},${here}`;
}

export type OllamaState = "ok" | "blocked" | "unreachable";

// "blocked": Ollama answered, but not to this site (OLLAMA_ORIGINS does not include it).
// "unreachable": nothing answered at that address (not running, wrong address, or the
// browser refused to reach the local network).
export async function diagnoseOllama(baseUrl: string): Promise<OllamaState> {
  const root = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  try {
    const r = await fetch(`${root}/api/version`);
    if (r.ok) return "ok";
  } catch {
    /* fall through to the opaque probe */
  }
  try {
    // An opaque request succeeds when the server answers at all, even if it does not
    // allow this site to read the answer.
    await fetch(`${root}/api/version`, { mode: "no-cors" });
    return "blocked";
  } catch {
    return "unreachable";
  }
}

export interface OsSteps {
  id: string;
  label: string;
  steps: { text: string; command?: string }[];
}

export function ollamaSetupSteps(): OsSteps[] {
  const origins = originsValue();
  return [
    {
      id: "windows",
      label: "Windows",
      steps: [
        { text: "Quit Ollama: right-click the llama icon by the clock, then Quit." },
        { text: "Open PowerShell and run:", command: `setx OLLAMA_ORIGINS "${origins}"` },
        { text: "Start Ollama again from the Start menu, then press Test connection." },
      ],
    },
    {
      id: "mac",
      label: "Mac",
      steps: [
        { text: "In Terminal, run:", command: `launchctl setenv OLLAMA_ORIGINS "${origins}"` },
        { text: "Quit Ollama from the menu bar and open it again, then press Test connection." },
      ],
    },
    {
      id: "linux",
      label: "Linux",
      steps: [
        { text: "Stop the Ollama service, then start it with:", command: `OLLAMA_ORIGINS="${origins}" ollama serve` },
      ],
    },
    {
      id: "docker",
      label: "Docker",
      steps: [
        { text: "Remove the old container (your models stay in the ollama volume):", command: "docker rm -f ollama" },
        {
          text: "Start it again with the setting:",
          command: `docker run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama -e OLLAMA_ORIGINS="${origins}" ollama/ollama`,
        },
      ],
    },
  ];
}

export class OllamaConnectionError extends Error {
  constructor(public state: Exclude<OllamaState, "ok">, public baseUrl: string) {
    super(
      state === "blocked"
        ? "Ollama is running, but it is not allowing this website yet. Follow the steps below once."
        : `Nothing answered at ${baseUrl}. Start Ollama (or check the address). If it is running, your browser may be asking permission to reach devices on your network: allow it.`,
    );
  }
}
