/**
 * Generate rich, actionable JSON error catalogs from discovered errors.
 *
 * Output is designed to help developers:
 * 1. Know what errors can occur (documented + undocumented)
 * 2. Understand when they occur (trigger patterns)
 * 3. Know how to handle them (retry guidance, suggestions)
 * 4. See what's missing from official docs (undocumented count)
 */

import type { DiscoveredError } from "./types-generator.ts";

/** Error handling guidance for developers */
interface ErrorGuidance {
  retryable: boolean;
  suggestion: string;
}

/** A unique error with aggregated trigger patterns */
interface UniqueError {
  code: number;
  httpStatus?: number;
  category: string;
  isDocumented: boolean;
  message: string;
  /** Example inputs that trigger this error */
  triggerExamples: Array<Record<string, unknown>>;
  /** How many times this error was triggered */
  occurrences: number;
  /** Developer guidance */
  handling: ErrorGuidance;
  firstSeen: string;
}

/** Operation-level error summary */
interface OperationErrors {
  /** Errors from spec that we confirmed exist */
  documentedErrors: string[];
  /** All unique errors by tag */
  errors: Record<string, UniqueError>;
}

/** Service-level error catalog */
export interface EnhancedErrorCatalog {
  service: string;
  generatedAt: string;
  summary: {
    totalUniqueErrors: number;
    documentedErrors: number;
    undocumentedErrors: number;
    operationsCovered: string[];
    /** Documentation coverage percentage */
    documentationCoverage: string;
  };
  operations: Record<string, OperationErrors>;
}

/**
 * Infer error handling guidance based on error type.
 */
const getErrorGuidance = (tag: string, code: number, category: string): ErrorGuidance => {
  switch (category) {
    case "rate_limit":
      return {
        retryable: true,
        suggestion: "Implement exponential backoff. Check Retry-After header.",
      };
    case "authentication":
      return {
        retryable: false,
        suggestion: "Verify API token is valid and has required permissions.",
      };
    case "not_found":
      return {
        retryable: false,
        suggestion: "Verify resource exists before calling. Handle 404 gracefully.",
      };
    case "validation":
      return {
        retryable: false,
        suggestion: "Check input against schema. See message for specific field issues.",
      };
    case "quota":
      return {
        retryable: false,
        suggestion: "Check account limits. Consider upgrading plan or cleaning up resources.",
      };
    case "conflict":
      return {
        retryable: false,
        suggestion: "Resource already exists. Use update instead of create, or check for duplicates.",
      };
    default:
      return {
        retryable: false,
        suggestion: "Check error message for details. Contact Cloudflare support if persistent.",
      };
  }
};

/**
 * Generate enhanced JSON error catalog for a single service.
 */
export const generateServiceJson = (service: string, errors: DiscoveredError[]): EnhancedErrorCatalog => {
  const serviceErrors = errors.filter(e => e.service === service);

  // Group by operation, then deduplicate by tag+code
  const operations: Record<string, OperationErrors> = {};
  const allUniqueErrors = new Map<string, UniqueError>();

  for (const error of serviceErrors) {
    // Initialize operation if needed
    if (!operations[error.operation]) {
      operations[error.operation] = {
        documentedErrors: [],
        errors: {},
      };
    }

    const op = operations[error.operation]!;
    const errorKey = `${error.tag}:${error.code}`;

    // Track documented errors (those from the spec)
    if (error.isDocumented && !op.documentedErrors.includes(error.tag)) {
      op.documentedErrors.push(error.tag);
    }

    // Deduplicate and aggregate
    if (!op.errors[error.tag]) {
      op.errors[error.tag] = {
        code: error.code,
        httpStatus: error.httpStatus,
        category: error.category,
        isDocumented: error.isDocumented,
        message: error.message,
        triggerExamples: [],
        occurrences: 0,
        handling: getErrorGuidance(error.tag, error.code, error.category),
        firstSeen: error.discoveredAt,
      };
    }

    const uniqueError = op.errors[error.tag]!;
    uniqueError.occurrences++;

    // Add unique trigger examples (max 3)
    if (error.triggerInput && uniqueError.triggerExamples.length < 3) {
      const inputStr = JSON.stringify(error.triggerInput);
      const exists = uniqueError.triggerExamples.some(t => JSON.stringify(t) === inputStr);
      if (!exists) {
        uniqueError.triggerExamples.push(error.triggerInput);
      }
    }

    // Track globally for summary
    allUniqueErrors.set(errorKey, uniqueError);
  }

  // Calculate summary stats
  const uniqueErrorList = Array.from(allUniqueErrors.values());
  const documentedCount = uniqueErrorList.filter(e => e.isDocumented).length;
  const undocumentedCount = uniqueErrorList.filter(e => !e.isDocumented).length;
  const coverage = uniqueErrorList.length > 0
    ? `${Math.round((documentedCount / uniqueErrorList.length) * 100)}%`
    : "N/A";

  return {
    service,
    generatedAt: new Date().toISOString(),
    summary: {
      totalUniqueErrors: uniqueErrorList.length,
      documentedErrors: documentedCount,
      undocumentedErrors: undocumentedCount,
      operationsCovered: Object.keys(operations),
      documentationCoverage: coverage,
    },
    operations,
  };
};

/**
 * Generate all service JSON catalogs.
 */
export const generateAllJson = (errors: DiscoveredError[]): Record<string, EnhancedErrorCatalog> => {
  const services = [...new Set(errors.map(e => e.service))];
  const result: Record<string, EnhancedErrorCatalog> = {};

  for (const service of services) {
    result[service.toLowerCase()] = generateServiceJson(service, errors);
  }

  return result;
};

/**
 * Write error catalogs to disk.
 */
export const writeErrorCatalogs = async (
  errors: DiscoveredError[],
  outputDir: string
): Promise<void> => {
  const catalogs = generateAllJson(errors);

  for (const [serviceName, catalog] of Object.entries(catalogs)) {
    const filename = `${outputDir}/${serviceName}-errors.json`;
    await Bun.write(filename, JSON.stringify(catalog, null, 2));
  }
};
