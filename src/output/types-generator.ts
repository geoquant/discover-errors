/**
 * Generate TypeScript discriminated union types from discovered errors.
 */

export interface DiscoveredError {
  service: string;
  operation: string;
  tag: string;
  code: number;
  message: string;
  httpStatus?: number;
  discoveredAt: string;
  /** Whether this error is documented in the spec */
  isDocumented: boolean;
  /** The input that triggered this error */
  triggerInput?: Record<string, unknown>;
  /** Error category for developer guidance */
  category: "authentication" | "validation" | "not_found" | "rate_limit" | "quota" | "conflict" | "unknown";
}

/**
 * Capitalize first letter of a string.
 */
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Convert operation name to PascalCase type name.
 */
const toTypeName = (service: string, operation: string): string => {
  return `${capitalize(service)}${capitalize(operation)}Error`;
};

/**
 * Generate TypeScript discriminated union types from discovered errors.
 * 
 * @example
 * Input: [{ service: "Workers", operation: "createScript", tag: "ScriptAlreadyExists", code: 10021, message: "..." }]
 * Output:
 * export type WorkersCreateScriptError =
 *   | { _tag: "ScriptAlreadyExists"; code: 10021; message: string };
 */
export const generateTypes = (errors: DiscoveredError[]): string => {
  // Deduplicate errors by tag+code
  const uniqueErrors = errors.filter((error, index, self) =>
    index === self.findIndex(e => 
      e.service === error.service && 
      e.operation === error.operation && 
      e.tag === error.tag && 
      e.code === error.code
    )
  );

  // Group errors by service and operation
  const grouped = new Map<string, Map<string, DiscoveredError[]>>();
  
  for (const error of uniqueErrors) {
    if (!grouped.has(error.service)) {
      grouped.set(error.service, new Map());
    }
    const serviceMap = grouped.get(error.service)!;
    if (!serviceMap.has(error.operation)) {
      serviceMap.set(error.operation, []);
    }
    serviceMap.get(error.operation)!.push(error);
  }

  const lines: string[] = [
    "/**",
    " * Auto-generated Cloudflare API error types.",
    ` * Generated: ${new Date().toISOString()}`,
    " */",
    "",
  ];

  for (const [service, operations] of grouped) {
    lines.push(`// ${service} Errors`);
    lines.push("");
    
    for (const [operation, opErrors] of operations) {
      const typeName = toTypeName(service, operation);
      
      if (opErrors.length === 0) continue;
      
      lines.push(`export type ${typeName} =`);
      
      opErrors.forEach((error, index) => {
        const prefix = index === 0 ? "  |" : "  |";
        lines.push(`${prefix} { _tag: "${error.tag}"; code: ${error.code}; message: string }`);
      });
      
      lines.push(";");
      lines.push("");
    }
  }

  return lines.join("\n");
};

/**
 * Generate a single service's error types file content.
 */
export const generateServiceTypes = (service: string, errors: DiscoveredError[]): string => {
  const serviceErrors = errors.filter(e => e.service === service);
  return generateTypes(serviceErrors);
};
