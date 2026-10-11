// Portable blueprint generation core: prompt construction, LLM provider routing and
// response parsing. Shared by the Express server (server.ts) and the Cloudflare Pages
// Function (functions/api/generate.ts), so it must not import Node-only modules.
import { GoogleGenAI } from "@google/genai";

export type LlmEnv = Record<string, string | undefined>;

export interface BlueprintPromptInput {
  notes: string;
  codebaseContext?: string;
  audioTranscript?: string;
  targetPlatform?: string;
  emailToUse: string;
  constVersion: string;
  constState: string;
  jurisdictionProfileName: string;
}

export interface BlueprintModelOptions {
  selectedProvider: string;
  apiKey?: string;
  modelName?: string;
  customUrl?: string;
  authMode?: string;
  customHeaderName?: string;
  systemPrompt: string;
  userPrompt: string;
  // "json" (default) asks providers that support it for a JSON-only reply; "text" for free text such as code.
  responseFormat?: "json" | "text";
}

async function callVeklom(env: LlmEnv, params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  apiKey?: string;
}): Promise<string> {
  const baseUrl =
    env.VEKLOM_BASE_URL?.replace(/\/+$/, "") ||
    "https://api.veklom.com";

  const apiKey = env.VEKLOM_API_KEY || params.apiKey;

  if (!apiKey) {
    throw new Error("VEKLOM_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl}/v1/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      prompt: [
        "SYSTEM INSTRUCTIONS:",
        params.systemPrompt,
        "",
        "USER REQUEST:",
        params.userPrompt,
      ].join("\n"),
      model: params.model || env.VEKLOM_MODEL || "qwen2.5:3b",
      use_memory: false,
      max_tokens: 8192,
      temperature: 0.2,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Veklom request failed with HTTP ${response.status}: ${responseText}`
    );
  }

  const data = JSON.parse(responseText);

  if (typeof data.response !== "string" || !data.response.trim()) {
    throw new Error("Veklom returned no inference response.");
  }

  return data.response;
}

export function buildBlueprintPrompts(input: BlueprintPromptInput) {
  const { notes, codebaseContext, audioTranscript, targetPlatform, emailToUse, constVersion, constState, jurisdictionProfileName } = input;
    // Full JSON Schema representing BlueprintResult interface
    const blueprintJsonSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "title": { "type": "string", "description": "A highly premium, precise business name" },
        "tagline": { "type": "string", "description": "A punchy, capability-oriented value statement" },
        "timestamp": { "type": "string" },
        "hash": { "type": "string" },
        "highLevelGoals": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" },
              "status": { "type": "string" }
            },
            "required": ["title", "description", "status"]
          }
        },
        "competitiveMoat": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "capabilityName": { "type": "string" },
              "description": { "type": "string" },
              "advantageScore": { "type": "number" }
            },
            "required": ["capabilityName", "description", "advantageScore"]
          }
        },
        "einsteinProbability": {
          "type": "object",
          "properties": {
            "modelName": { "type": "string" },
            "successRate": { "type": "number" },
            "latencyMs": { "type": "number" },
            "variables": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "impact": { "type": "string" }
                },
                "required": ["name", "impact"]
              }
            }
          },
          "required": ["modelName", "successRate", "latencyMs", "variables"]
        },
        "academicGrounding": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "author": { "type": "string" },
              "source": { "type": "string" },
              "summary": { "type": "string" },
              "relevance": { "type": "string" }
            },
            "required": ["title", "author", "source", "summary", "relevance"]
          }
        },
        "companyGraph": {
          "type": "object",
          "properties": {
            "domains": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "description": { "type": "string" },
                  "products": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["name", "description", "products"]
              }
            },
            "products": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "domain": { "type": "string" },
                  "businessValue": { "type": "string" },
                  "owner": { "type": "string" }
                },
                "required": ["name", "domain", "businessValue", "owner"]
              }
            },
            "canonicalSystems": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "techStack": { "type": "string" },
                  "purpose": { "type": "string" }
                },
                "required": ["name", "techStack", "purpose"]
              }
            },
            "repositories": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "url": { "type": "string" },
                  "capabilities": { "type": "array", "items": { "type": "string" } },
                  "status": { "type": "string" }
                },
                "required": ["name", "url", "capabilities", "status"]
              }
            },
            "environments": { "type": "array", "items": { "type": "string" } },
            "owners": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "role": { "type": "string" },
                  "team": { "type": "string" }
                },
                "required": ["name", "role", "team"]
              }
            },
            "revenueStreams": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "description": { "type": "string" },
                  "model": { "type": "string" }
                },
                "required": ["name", "description", "model"]
              }
            },
            "policies": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "rule": { "type": "string" },
                  "scope": { "type": "string" }
                },
                "required": ["name", "rule", "scope"]
              }
            },
            "externalProviders": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "service": { "type": "string" },
                  "sla": { "type": "string" }
                },
                "required": ["name", "service", "sla"]
              }
            }
          },
          "required": ["domains", "products", "canonicalSystems", "repositories", "environments", "owners", "revenueStreams", "policies", "externalProviders"]
        },
        "capabilities": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "name": { "type": "string" },
              "purpose": { "type": "string" },
              "businessOutcome": { "type": "string" },
              "machineOutcome": { "type": "string" },
              "inputs": { "type": "array", "items": { "type": "string" } },
              "outputs": { "type": "array", "items": { "type": "string" } },
              "preconditions": { "type": "array", "items": { "type": "string" } },
              "postconditions": { "type": "array", "items": { "type": "string" } },
              "owner": { "type": "string" },
              "primaryOwner": { "type": "string" },
              "technicalOwner": { "type": "string" },
              "dataOwner": { "type": "string" },
              "complianceOwner": { "type": "string" },
              "canonicalSystem": { "type": "string" },
              "canonicalDataDomain": { "type": "string" },
              "canonicalServiceSystem": { "type": "string" },
              "canonicalRepoImplementation": { "type": "string" },
              "nonCanonicalMirrors": { "type": "array", "items": { "type": "string" } },
              "supportingServices": { "type": "array", "items": { "type": "string" } },
              "exposedInterfaces": {
                "type": "object",
                "properties": {
                  "rest": { "type": "array", "items": { "type": "string" } },
                  "mcp": { "type": "array", "items": { "type": "string" } },
                  "sdk": { "type": "array", "items": { "type": "string" } },
                  "cli": { "type": "array", "items": { "type": "string" } },
                  "ui": { "type": "array", "items": { "type": "string" } },
                  "webhooks": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["rest", "mcp", "sdk", "cli", "ui", "webhooks"]
              },
              "exposureSurfaces": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "type": { "type": "string" },
                    "identifier": { "type": "string" },
                    "description": { "type": "string" },
                    "status": { "type": "string" },
                    "stableId": { "type": "string" },
                    "semanticVersion": { "type": "string" },
                    "priorVersionPointer": { "type": "string" },
                    "deprecationFlag": { "type": "boolean" },
                    "replacementPointer": { "type": "string" }
                  },
                  "required": ["type", "identifier", "description", "status"]
                }
              },
              "pricingModel": {
                "type": "object",
                "properties": {
                  "billingUnit": { "type": "string" },
                  "priceFloor": { "type": "number" },
                  "includedQuota": { "type": "string" },
                  "overage": { "type": "string" },
                  "settlementCompat": { "type": "string" },
                  "costToServe": { "type": "string" },
                  "marginEstimate": { "type": "number" }
                },
                "required": ["billingUnit", "priceFloor", "includedQuota", "overage", "settlementCompat", "costToServe", "marginEstimate"]
              },
              "governance": {
                "type": "object",
                "properties": {
                  "requiredApprovals": { "type": "array", "items": { "type": "string" } },
                  "budgetRules": { "type": "string" },
                  "dataBoundaries": { "type": "string" },
                  "delegations": { "type": "string" },
                  "auditReqs": { "type": "string" },
                  "killSwitchRules": { "type": "string" },
                  "limits": { "type": "string" }
                },
                "required": ["requiredApprovals", "budgetRules", "dataBoundaries", "delegations", "auditReqs", "killSwitchRules", "limits"]
              },
              "evidence": {
                "type": "object",
                "properties": {
                  "evidenceProduced": { "type": "string" },
                  "hashAlgorithm": { "type": "string" },
                  "ledgerStorage": { "type": "string" },
                  "verifiable": { "type": "boolean" },
                  "privateDetails": { "type": "string" },
                  "completedProof": { "type": "string" },
                  "classification": { "type": "string" },
                  "evidenceTimestamp": { "type": "string" },
                  "freshnessWindowDays": { "type": "number" },
                  "nextRevalidationDue": { "type": "string" },
                  "trustDecayFactor": { "type": "number" }
                },
                "required": ["evidenceProduced", "hashAlgorithm", "ledgerStorage", "verifiable", "privateDetails", "completedProof", "classification"]
              },
              "verification": {
                "type": "object",
                "properties": {
                  "unitTests": { "type": "array", "items": { "type": "string" } },
                  "contractTests": { "type": "array", "items": { "type": "string" } },
                  "fixtureTests": { "type": "array", "items": { "type": "string" } },
                  "mcpTests": { "type": "array", "items": { "type": "string" } },
                  "securityTests": { "type": "array", "items": { "type": "string" } },
                  "latencySlo": { "type": "string" },
                  "driftChecks": { "type": "string" }
                },
                "required": ["unitTests", "contractTests", "fixtureTests", "mcpTests", "securityTests", "latencySlo", "driftChecks"]
              },
              "dependencies": { "type": "array", "items": { "type": "string" } },
              "lifecycleState": { "type": "string" },
              "maturityState": { "type": "string" },
              "verificationState": { "type": "string" },
              "pricingState": { "type": "string" },
              "deprecationState": { "type": "string" },
              "jurisdictionPolicy": {
                "type": "object",
                "properties": {
                  "dataBoundaryProfile": { "type": "string" },
                  "jurisdictionConstraints": { "type": "array", "items": { "type": "string" } },
                  "paymentRailConstraints": { "type": "array", "items": { "type": "string" } },
                  "auditRetentionProfile": { "type": "string" },
                  "allowedRegions": { "type": "array", "items": { "type": "string" } },
                  "blockedRegions": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["dataBoundaryProfile", "jurisdictionConstraints", "paymentRailConstraints", "auditRetentionProfile"]
              }
            },
            "required": ["id", "name", "purpose", "businessOutcome", "machineOutcome", "inputs", "outputs", "preconditions", "postconditions", "owner", "canonicalSystem", "exposedInterfaces", "exposureSurfaces", "pricingModel", "governance", "evidence", "verification", "dependencies", "lifecycleState", "maturityState", "verificationState", "pricingState", "deprecationState", "jurisdictionPolicy"]
          }
        },
        "productOfferings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "description": { "type": "string" },
              "capabilities": { "type": "array", "items": { "type": "string" } },
              "priceModel": { "type": "string" },
              "entitlements": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["name", "description", "capabilities", "priceModel", "entitlements"]
          }
        },
        "gapsReport": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "system": { "type": "string" },
              "missing": { "type": "string" },
              "severity": { "type": "string" },
              "impact": { "type": "string" }
            },
            "required": ["system", "missing", "severity", "impact"]
          }
        },
        "files": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "content": { "type": "string" }
            },
            "required": ["path", "content"]
          }
        },
        "agentPackets": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" },
              "targetRole": { "type": "string" },
              "summary": { "type": "string" },
              "objective": { "type": "string" },
              "scope": { "type": "string" },
              "files": { "type": "array", "items": { "type": "string" } },
              "contracts": { "type": "string" },
              "dependencies": { "type": "array", "items": { "type": "string" } },
              "tests": { "type": "array", "items": { "type": "string" } },
              "migrations": { "type": "string" },
              "performanceTargets": { "type": "string" },
              "securityConstraints": { "type": "string" },
              "docsToUpdate": { "type": "array", "items": { "type": "string" } },
              "definitionOfDone": { "type": "array", "items": { "type": "string" } },
              "rollbackNotes": { "type": "string" }
            },
            "required": ["id", "title", "targetRole", "summary", "objective", "scope", "files", "contracts", "dependencies", "tests", "migrations", "performanceTargets", "securityConstraints", "docsToUpdate", "definitionOfDone", "rollbackNotes"]
          }
        }
      },
      "required": ["title", "tagline", "timestamp", "hash", "highLevelGoals", "competitiveMoat", "einsteinProbability", "academicGrounding", "companyGraph", "capabilities", "productOfferings", "gapsReport", "files", "agentPackets"]
    };

    // Dynamic, comprehensive system prompt that enforces all capability-based operating system structures
    const systemPrompt = `You are the world's most advanced Hierarchical Reasoning Model (HRM) Software & Business Architect.
Your mission is to compile messy ideas, text, and optional codebase structures into an elite, production-grade Software Blueprint and COMPLETE BUSINESS PLAN structured around Capability-Based Product Architecture.

Philosophy: "API is not the product; Capability is the product."
Treat APIs, models, pricing, governance, evidence, and UX as downstream implementation surfaces of underlying core Capability Products.
Integrate X402 payment protocol standards (machine-to-machine global automated payment settlements, smart contract decentralized liquidity execution) into the business models.
Incorporate Einstein's approach on probability for dynamic task prioritization based on complex data trend frequencies.

CONSTITUTION & COMPLIANCE ENGINE CONSTRAINTS:
- Current Constitution Version: ${constVersion}
- Current Constitution Lock Status: ${constState}
- Active Jurisdiction Profile: ${jurisdictionProfileName}

You MUST ensure that:
1. Every generated capability includes exact compliance state fields: 'lifecycleState', 'maturityState' ('Conceptual', 'Partially Simulated', or 'Sovereign Production'), 'verificationState' ('Unverified', 'Verified', or 'Drift Detected'), 'pricingState' ('Unpriced', 'Draft Price', 'Active Pricing', or 'Deprecated Pricing'), 'deprecationState' ('None', 'Deprecation Warning Issued', 'Sunset Scheduled', or 'Retired'), and 'jurisdictionPolicy' matching the active jurisdiction profile constraints.
2. The generated files (especially README.md, manifest.md, registry.md, and work_orders.md) are strictly updated and constrained based on this active jurisdiction's profile, baseline standards (e.g. Canada ISED 'AI for All' pins enclaves strictly to AWS ca-central-1 and local Canadian hosts and biometric export limits) and are locked under this constitution version.

CRITICAL STRUCTURAL OUTPUT CONSTRAINTS:
1. The output MUST contain a minimum of 4 capabilities inferred from the input.
2. The output MUST contain exactly or at least 2 agentPackets inside the "agentPackets" array (e.g., pkt-1 and pkt-2).
3. The companyGraph MUST be populated with valid nodes (domains, products, canonicalSystems, repositories, environments, owners, revenueStreams, policies, externalProviders).
4. Each capability MUST contain a fully populated governance block (budgetRules, requiredApprovals, etc.) and pricingModel block (billingUnit, priceFloor, etc. where pricing contains at least 2 line items or parameters).
5. DO NOT output any introductory text, explanatory notes, markdown formatting, code fences or wrappers outside the raw JSON object itself. Respond with ONLY the pure, valid JSON object.

Below is the exact JSON Schema that your output MUST match:
${JSON.stringify(blueprintJsonSchema, null, 2)}

Make sure your output is mathematically rigorous, fully detailed, and matches this schema letter for letter. Do not include placeholders like "..." or list items without completing them.`;

    const userPrompt = `Messy notes/intent:
${notes}

Optional codebase context:
${codebaseContext || "None provided"}

Optional audio transcripts:
${audioTranscript || "None provided"}

Target platform:
${targetPlatform || "Multi-platform Web/Mobile"}

User Email for validation:
${emailToUse}`;

  return { systemPrompt, userPrompt };
}

export async function callBlueprintModel(opts: BlueprintModelOptions, env: LlmEnv): Promise<string> {
  const { selectedProvider, apiKey, modelName, customUrl, authMode, customHeaderName, systemPrompt, userPrompt } = opts;
  const wantJson = opts.responseFormat !== "text";
    // Use the already declared selectedProvider
    let textResult = "";

    if (selectedProvider === "veklom") {
      textResult = await callVeklom(env, {
        systemPrompt,
        userPrompt,
        model: modelName,
        apiKey: apiKey,
      });
    } else if (selectedProvider === "gemini") {
      const activeApiKey = apiKey || env.GEMINI_API_KEY;
      if (!activeApiKey) {
        throw new Error("Gemini API key is not configured. Please supply a key or configure it in secrets.");
      }

      // Check if custom URL or environment base URL is provided
      const geminiBaseUrl = customUrl || env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const aiOptions: any = {
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      };
      if (geminiBaseUrl) {
        aiOptions.baseUrl = geminiBaseUrl;
      }

      const ai = new GoogleGenAI(aiOptions);

      const response = await ai.models.generateContent({
        model: modelName || "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          ...(wantJson ? { responseMimeType: "application/json" } : {}),
          temperature: 0.2,
        },
      });

      textResult = response.text || "";
    } else if (selectedProvider === "openai" || selectedProvider === "llama" || selectedProvider === "ollama" || selectedProvider === "deepseek" || selectedProvider === "custom") {
      // Determine base URL to use
      let openAiBaseUrl = "https://api.openai.com/v1";
      if (customUrl) {
        openAiBaseUrl = customUrl;
      } else if (selectedProvider === "llama" || selectedProvider === "ollama") {
        openAiBaseUrl = env.AI_INTEGRATIONS_OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
      } else if (selectedProvider === "deepseek") {
        openAiBaseUrl = "https://api.deepseek.com/v1";
      } else if (selectedProvider === "openai") {
        openAiBaseUrl = env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      }

      // Clean the endpoint: strip trailing slashes, make sure it has /chat/completions
      let cleanUrl = openAiBaseUrl.replace(/\/+$/, "");
      if (!cleanUrl.endsWith("/chat/completions")) {
        cleanUrl = `${cleanUrl}/chat/completions`;
      }

      // Configure headers
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Dynamic auth mode application
      if (apiKey) {
        if (authMode === "bearer") {
          headers.Authorization = `Bearer ${apiKey}`;
        } else if (authMode === "apiKeyHeader") {
          headers["x-api-key"] = apiKey;
        } else if (authMode === "customHeader" && customHeaderName) {
          headers[customHeaderName] = apiKey;
        } else if (authMode === "none") {
          // No authentication headers
        } else {
          // Default fallback
          headers.Authorization = `Bearer ${apiKey}`;
        }
      } else if (selectedProvider === "openai" && !env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        // Only require API key if using real OpenAI without a local modelfarm/proxy override
        throw new Error("OpenAI API key is required for this model provider.");
      }

      // Build payload
      const payload: any = {
        model: modelName || (selectedProvider === "deepseek" ? "deepseek-chat" : selectedProvider === "openai" ? (openAiBaseUrl.includes("11434") || openAiBaseUrl.includes("167.233.202.195") ? "llama3.2:1b" : "gpt-4o") : "llama3.2:latest"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      };

      // Only pass JSON response format if using a provider known to support it natively
      if (wantJson && (selectedProvider === "openai" || selectedProvider === "deepseek" || selectedProvider === "llama" || selectedProvider === "ollama")) {
        payload.response_format = { type: "json_object" };
      }

      console.log(`Routing ${selectedProvider} request to: ${cleanUrl} with model: ${payload.model}`);

      const response = await fetch(cleanUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${selectedProvider.toUpperCase()} API failed: ${errorText}`);
      }
      const data = await response.json();
      textResult = data.choices[0].message.content;
    } else if (selectedProvider === "anthropic") {
      const activeApiKey = apiKey;
      if (!activeApiKey) {
        throw new Error("Anthropic API key is required.");
      }

      const anthropicUrl = customUrl || "https://api.anthropic.com/v1/messages";

      const headers = {
        "Content-Type": "application/json",
        "x-api-key": activeApiKey,
        "anthropic-version": "2023-06-01",
      };

      const payload = {
        model: modelName || "claude-opus-5-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ],
      };

      const response = await fetch(anthropicUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API failed: ${errorText}`);
      }

      const data = await response.json();
      if (data.stop_reason === "refusal") {
        throw new Error("Anthropic declined this request (stop_reason: refusal).");
      }
      textResult = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    } else {
      // General fallback using server key to compile with Gemini
      const activeApiKey = env.GEMINI_API_KEY;
      if (!activeApiKey) {
        throw new Error("No server-side Gemini key is configured. Open LLM Engine and enter your own provider API key.");
      }

      const geminiBaseUrl = env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const aiOptions: any = {
        apiKey: activeApiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      };
      if (geminiBaseUrl) {
        aiOptions.baseUrl = geminiBaseUrl;
      }

      const ai = new GoogleGenAI(aiOptions);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          ...(wantJson ? { responseMimeType: "application/json" } : {}),
          temperature: 0.2,
        },
      });
      textResult = response.text || "";
    }

  return textResult;
}

// Parses the model's text into a blueprint object. Missing required sections are left
// empty and flagged with partial: true; nothing is filled in from sample data.
export function parseBlueprintText(textResult: string): any {
    let parsedData: any;
    try {
      parsedData = JSON.parse(textResult);
    } catch (parseError) {
      const jsonMatch = textResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (matchError) {
          console.error("Match parse failure, trying fallback slice. Original raw:", textResult);
          const startIdx = textResult.indexOf('{');
          const endIdx = textResult.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            try {
              parsedData = JSON.parse(textResult.slice(startIdx, endIdx + 1));
            } catch (sliceError) {
              throw new Error("parse_failed: " + textResult.slice(0, 200));
            }
          } else {
            throw new Error("parse_failed: " + textResult.slice(0, 200));
          }
        }
      } else {
        const startIdx = textResult.indexOf('{');
        const endIdx = textResult.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          try {
            parsedData = JSON.parse(textResult.slice(startIdx, endIdx + 1));
          } catch (sliceError) {
            throw new Error("parse_failed: " + textResult.slice(0, 200));
          }
        } else {
          throw new Error("parse_failed: " + textResult.slice(0, 200));
        }
      }
    }

    // Do not merge or fall back to defaultBlueprint data. If the compile output is incomplete, return the partial result with a partial: true flag and let the frontend render what was produced.
    let isPartial = false;
    const requiredFields = ["title", "tagline", "highLevelGoals", "competitiveMoat", "einsteinProbability", "academicGrounding", "companyGraph", "capabilities", "productOfferings", "gapsReport", "files", "agentPackets"];
    for (const field of requiredFields) {
      if (!parsedData[field]) {
        if (field === "title" || field === "tagline") {
          parsedData[field] = "";
        } else if (field === "timestamp") {
          parsedData[field] = new Date().toISOString();
        } else if (field === "hash") {
          parsedData[field] = "";
        } else if (field === "einsteinProbability") {
          parsedData[field] = { modelName: "", successRate: 0, latencyMs: 0, variables: [] };
        } else if (field === "companyGraph") {
          parsedData[field] = { domains: [], products: [], canonicalSystems: [], repositories: [], environments: [], owners: [], revenueStreams: [], policies: [], externalProviders: [] };
        } else {
          parsedData[field] = [];
        }
        isPartial = true;
      }
    }
    if (isPartial) {
      parsedData.partial = true;
    }

  return parsedData;
}
