/**
 * Core TypeScript types for Cloudflare API responses, credentials, and configurations.
 */

import { Context } from "effect";

/**
 * Cloudflare API error object as returned in the response.
 */
export interface CloudflareApiError {
  code: number;
  message: string;
}

/**
 * Standard Cloudflare API response wrapper.
 * All Cloudflare REST API endpoints return this structure.
 */
export interface CloudflareResponse<T> {
  success: boolean;
  errors: CloudflareApiError[];
  messages: string[];
  result: T | null;
}

/**
 * Cloudflare API credentials service.
 * Provides the API token for authentication.
 */
export interface CloudflareCredentials {
  readonly apiToken: string;
}

export const CloudflareCredentials = Context.GenericTag<CloudflareCredentials>(
  "@cloudflare/Credentials"
);

/**
 * Cloudflare Account ID service.
 * Most Cloudflare API endpoints are account-scoped and require this.
 */
export interface CloudflareAccountId {
  readonly accountId: string;
}

export const CloudflareAccountId = Context.GenericTag<CloudflareAccountId>(
  "@cloudflare/AccountId"
);

/**
 * Cloudflare API configuration.
 */
export interface CloudflareConfig {
  readonly baseUrl: string;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
}

export const CloudflareConfig = Context.GenericTag<CloudflareConfig>(
  "@cloudflare/Config"
);

/**
 * Default Cloudflare API configuration.
 */
export const defaultCloudflareConfig: CloudflareConfig = {
  baseUrl: "https://api.cloudflare.com/client/v4",
  retryAttempts: 3,
  retryDelayMs: 1000,
};
