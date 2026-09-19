import "server-only";

/**
 * Categories come from Panta's allowlist at GET /categories/ and are rendered
 * as-is. This module exists so category access has one import path even though
 * the fetch itself lives alongside the other market reads.
 */
export { listCategories } from "./markets";
