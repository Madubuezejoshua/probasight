/**
 * Test stub for Next.js's `server-only` guard.
 *
 * The real package has no resolvable runtime entry under Vitest. Stubbing it
 * lets server modules be unit-tested directly; the genuine guard still applies
 * in the Next build, where importing a server-only module from a client
 * component fails the build.
 */
export {};
