import Ajv, { type ErrorObject } from "ajv";

/**
 * Schema Validator - The "Lie Detector"
 *
 * Automated JSON Schema validation for dispute adjudication.
 * When a user disputes a tool with reason "schema_mismatch",
 * this validator checks if the tool's output matches its declared outputSchema.
 *
 * Why this matters:
 * - Objective: A robot can determine if JSON matches a schema
 * - Instant: No human review needed for schema disputes
 * - Trustless: Math doesn't lie, and neither does ajv
 */

// Singleton ajv instance with sensible defaults
const ajv = new Ajv({
  allErrors: true, // Report all errors, not just the first
  strict: false, // Allow additional properties by default
  validateFormats: false, // Don't require format validation (e.g., email)
});

export type ValidationResult = {
  isValid: boolean;
  errors: ErrorObject[] | null;
  errorMessages: string[];
};

/**
 * Validate tool output against its declared outputSchema
 *
 * @param output - The actual output returned by the tool (queryOutput)
 * @param schema - The declared outputSchema from the tool definition
 * @returns ValidationResult with isValid flag and detailed errors
 */
export function validateToolOutput(
  output: unknown,
  schema: unknown
): ValidationResult {
  // Handle edge cases
  if (!schema) {
    // No schema declared = can't validate = assume valid
    return {
      isValid: true,
      errors: null,
      errorMessages: ["No outputSchema declared - cannot validate"],
    };
  }

  if (output === undefined || output === null) {
    return {
      isValid: false,
      errors: null,
      errorMessages: ["Tool returned null or undefined output"],
    };
  }

  try {
    // Compile schema (ajv caches compiled schemas automatically)
    const validate = ajv.compile(schema as object);
    const isValid = validate(output);

    if (isValid) {
      return {
        isValid: true,
        errors: null,
        errorMessages: [],
      };
    }

    // Schema validation failed - extract readable errors
    const errorMessages = (validate.errors || []).map((err) => {
      const path = err.instancePath || "(root)";
      const message = err.message || "Unknown error";
      return `${path}: ${message}`;
    });

    return {
      isValid: false,
      errors: validate.errors || null,
      errorMessages,
    };
  } catch (error) {
    // Schema compilation error (malformed schema)
    return {
      isValid: false,
      errors: null,
      errorMessages: [
        `Schema compilation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }
}

/**
 * Quick check if output matches schema (boolean only)
 * Useful for fast filtering without needing error details
 */
export function isOutputValid(output: unknown, schema: unknown): boolean {
  return validateToolOutput(output, schema).isValid;
}

/**
 * Extract outputSchema from a tool's schema definition
 * Tools store their schema in toolSchema.tools[].outputSchema
 *
 * @param toolSchema - The full tool schema (toolSchema column from AITool)
 * @param toolName - The specific tool name to find
 * @returns The outputSchema or null if not found
 */
export function extractOutputSchema(
  toolSchema: unknown,
  toolName?: string
): unknown | null {
  if (!toolSchema || typeof toolSchema !== "object") {
    return null;
  }

  const schema = toolSchema as {
    kind?: string;
    tools?: Array<{
      name: string;
      outputSchema?: unknown;
    }>;
  };

  if (schema.kind !== "mcp" || !Array.isArray(schema.tools)) {
    return null;
  }

  // If toolName provided, find that specific tool
  if (toolName) {
    const tool = schema.tools.find((t) => t.name === toolName);
    return tool?.outputSchema ?? null;
  }

  // If no toolName, return first tool's schema (for single-tool MCP servers)
  return schema.tools[0]?.outputSchema ?? null;
}

/**
 * Adjudicate a schema_mismatch dispute automatically
 *
 * @param queryOutput - The actual output from the tool query
 * @param toolSchema - The tool's schema definition
 * @param toolName - Optional: specific tool name if MCP server has multiple tools
 * @returns Verdict and validation details
 */
export function adjudicateSchemaMismatch(
  queryOutput: unknown,
  toolSchema: unknown,
  toolName?: string
): {
  verdict: "guilty" | "innocent" | "manual_review";
  validationResult: ValidationResult;
  reason: string;
} {
  const outputSchema = extractOutputSchema(toolSchema, toolName);

  if (!outputSchema) {
    // No schema to validate against - can't auto-adjudicate
    return {
      verdict: "manual_review",
      validationResult: {
        isValid: true,
        errors: null,
        errorMessages: ["No outputSchema declared - requires manual review"],
      },
      reason: "Tool has no declared outputSchema, cannot auto-validate",
    };
  }

  const validationResult = validateToolOutput(queryOutput, outputSchema);

  if (validationResult.isValid) {
    // Output matches schema - dispute is invalid
    return {
      verdict: "innocent",
      validationResult,
      reason: "Tool output matches declared outputSchema",
    };
  }

  // Output doesn't match schema - tool is GUILTY
  return {
    verdict: "guilty",
    validationResult,
    reason: `Schema validation failed: ${validationResult.errorMessages.join("; ")}`,
  };
}

