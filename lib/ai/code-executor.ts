import vm from "node:vm";
import * as documentSkills from "@/lib/ai/skills/document";
import * as marketplaceSkills from "@/lib/ai/skills/marketplace";
import * as mcpSkills from "@/lib/ai/skills/mcp";
import { type SkillRuntime, setSkillRuntime } from "@/lib/ai/skills/runtime";
import * as storageSkills from "@/lib/ai/skills/storage";
import * as suggestionSkills from "@/lib/ai/skills/suggestions";
import * as weatherSkills from "@/lib/ai/skills/weather";

// Match code blocks with any language tag (ts, typescript, js, javascript, or none)
const CODE_BLOCK_REGEX = /```(?:\w+)?\s*([\s\S]*?)```/i;
const NAMED_IMPORT_REGEX = /^import\s+{([^}]+)}\s+from\s+["']([^"']+)["'];?/gim;

// Available modules for skill execution
const AVAILABLE_MODULES = {
  "@/lib/ai/skills/document": documentSkills,
  "@/lib/ai/skills/suggestions": suggestionSkills,
  "@/lib/ai/skills/weather": weatherSkills,
  // MCP Protocol Skills (The Standard)
  "@/lib/ai/skills/mcp": mcpSkills,
  // Marketplace Discovery (Always Free)
  "@/lib/ai/skills/marketplace": marketplaceSkills,
  // Persistent Storage (Context Volume)
  "@/lib/ai/skills/storage": storageSkills,
} as const;

export type AllowedModule = keyof typeof AVAILABLE_MODULES;
export const REGISTERED_SKILL_MODULES = Object.keys(
  AVAILABLE_MODULES
) as AllowedModule[];

export type SkillExecutionOptions = {
  code: string;
  runtime: SkillRuntime;
  allowedModules: AllowedModule[];
  timeoutMs?: number;
};

export type SkillExecutionResult =
  | {
      ok: true;
      data: unknown;
      logs: string[];
      durationMs: number;
    }
  | {
      ok: false;
      error: string;
      logs: string[];
      durationMs: number;
    };

const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function extractCode(code: string) {
  const match = CODE_BLOCK_REGEX.exec(code);
  if (match) {
    return match[1].trim();
  }
  return code.trim();
}

function sanitizeImportSpecifiers(specifiersRaw: string) {
  return specifiersRaw
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .map((identifier) => {
      if (!IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(
          `Unsupported import syntax "${identifier}". Use simple named imports without aliases.`
        );
      }
      return identifier;
    });
}

function transformImports(
  code: string,
  allowedMap: Map<string, AllowedModule>
) {
  return code.replace(
    NAMED_IMPORT_REGEX,
    (_match, importsRaw: string, moduleId: string) => {
      const trimmedModule = moduleId.trim() as AllowedModule;
      if (!allowedMap.has(trimmedModule)) {
        throw new Error(
          `Import "${moduleId}" is not permitted in this execution context.`
        );
      }

      const specifiers = sanitizeImportSpecifiers(importsRaw);
      if (specifiers.length === 0) {
        throw new Error("Empty import specifier list is not allowed.");
      }

      return `const { ${specifiers.join(
        ", "
      )} } = __skillImports["${trimmedModule}"];`;
    }
  );
}

function stripExports(code: string) {
  return (
    code
      // export async function main() {}
      .replace(/export\s+async\s+function\s+main/gi, "async function main")
      // export function main() {}
      .replace(/export\s+function\s+main/gi, "function main")
      // export const main = async () => {}
      .replace(/export\s+const\s+main\s*=/gi, "const main =")
  );
}

function buildExecutionContext(
  allowedMap: Map<string, AllowedModule>,
  logs: string[],
  runtime: SkillRuntime
) {
  const allowedImportEntries = Array.from(allowedMap.entries()).map(
    ([moduleId, specifier]) => {
      const mod = AVAILABLE_MODULES[specifier];
      return [moduleId, mod];
    }
  );
  const allowedImports = Object.fromEntries(allowedImportEntries);

  const consoleProxy = {
    log: (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    },
    error: (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    },
    warn: (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    },
  };

  return vm.createContext({
    console: consoleProxy,
    __skillImports: allowedImports,
    __skillRuntime: runtime,
  });
}

export async function executeSkillCode({
  code,
  runtime,
  allowedModules,
  timeoutMs = 5000,
}: SkillExecutionOptions): Promise<SkillExecutionResult> {
  const logs: string[] = [];
  const start = Date.now();

  try {
    const allowedMap = new Map<string, AllowedModule>();
    for (const moduleId of allowedModules) {
      if (!AVAILABLE_MODULES[moduleId]) {
        throw new Error(`Module "${moduleId}" is not registered as a skill.`);
      }
      allowedMap.set(moduleId, moduleId);
    }

    if (allowedMap.size === 0) {
      throw new Error("No allowed modules were provided for execution.");
    }

    let scriptSource = extractCode(code);
    scriptSource = transformImports(scriptSource, allowedMap);
    scriptSource = stripExports(scriptSource);

    const context = buildExecutionContext(allowedMap, logs, runtime);
    const script = new vm.Script(
      `${scriptSource}\n;globalThis.__skillMain = typeof main === "function" ? main : undefined;`
    );

    script.runInContext(context, { timeout: timeoutMs });

    const mainFn = (context as vm.Context & { __skillMain?: unknown })
      .__skillMain;

    if (typeof mainFn !== "function") {
      throw new Error(
        "No main() function found. Export an async function named main."
      );
    }

    setSkillRuntime(runtime);
    const data = await Promise.resolve(mainFn());
    return {
      ok: true,
      data,
      logs,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    console.error("VM execution error raw:", error); // NEW: Log raw error
    const message =
      error instanceof Error ? error.message : "Skill execution failed";
    return {
      ok: false,
      error: message,
      logs,
      durationMs: Date.now() - start,
    };
  } finally {
    setSkillRuntime(null);
  }
}
