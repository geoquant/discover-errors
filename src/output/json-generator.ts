/**
 * Generate JSON error catalogs from discovered errors.
 */

import type { DiscoveredError } from "./types-generator.ts";

export interface ErrorCatalog {
  service: string;
  generatedAt: string;
  operations: Record<string, {
    errors: Array<{
      tag: string;
      code: number;
      message: string;
      httpStatus?: number;
      discoveredAt: string;
    }>;
  }>;
}

/**
 * Generate JSON error catalog for a single service.
 */
export const generateServiceJson = (service: string, errors: DiscoveredError[]): ErrorCatalog => {
  const serviceErrors = errors.filter(e => e.service === service);
  
  const operations: ErrorCatalog["operations"] = {};
  
  for (const error of serviceErrors) {
    if (!operations[error.operation]) {
      operations[error.operation] = { errors: [] };
    }
    operations[error.operation]!.errors.push({
      tag: error.tag,
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      discoveredAt: error.discoveredAt,
    });
  }

  return {
    service,
    generatedAt: new Date().toISOString(),
    operations,
  };
};

/**
 * Generate all service JSON catalogs.
 */
export const generateAllJson = (errors: DiscoveredError[]): Record<string, ErrorCatalog> => {
  const services = [...new Set(errors.map(e => e.service))];
  const result: Record<string, ErrorCatalog> = {};
  
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
