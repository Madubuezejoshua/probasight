import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against source files that exist locally but are missing from the
 * repository — and therefore from every deployment.
 *
 * This is not hypothetical. A `.gitignore` entry of `build` (intended for a
 * root build directory) is unanchored, so it matched a directory named `build`
 * at ANY depth. That silently excluded four API routes:
 *
 *   /api/panta/trade/build            — primary buy transaction builder
 *   /api/panta/create/build           — market creation transaction builder
 *   /api/panta/claims/winnings/build  — win claim builder
 *   /api/panta/claims/creator-fees/build
 *
 * Every local check passed because the files were on disk. The deployed app had
 * no way to build any transaction at all. The failure mode is silent by
 * construction, so it needs a test rather than vigilance.
 */

const REPO_ROOT = path.resolve(__dirname, "..");

function gitTrackedFiles(): Set<string> {
  const out = execFileSync("git", ["ls-files"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return new Set(
    out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, "/")),
  );
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function sourceFilesOnDisk(root: string): string[] {
  return walk(path.join(REPO_ROOT, root))
    .filter((f) => /\.(ts|tsx|css|svg)$/.test(f))
    .map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, "/"));
}

describe("every source file is tracked by git", () => {
  const tracked = gitTrackedFiles();

  it("tracks every file under src/", () => {
    const missing = sourceFilesOnDisk("src").filter((f) => !tracked.has(f));
    expect(missing, `untracked source files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("tracks every file under tests/", () => {
    const missing = sourceFilesOnDisk("tests").filter((f) => !tracked.has(f));
    expect(missing, `untracked test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("tracks every API route handler", () => {
    // The specific class of file the bug hid. Called out separately so a
    // failure names the real consequence rather than a generic path list.
    const routes = sourceFilesOnDisk("src").filter((f) => f.endsWith("/route.ts"));
    const missing = routes.filter((f) => !tracked.has(f));
    expect(
      missing,
      `API routes missing from the repository — these would 404 in production:\n${missing.join("\n")}`,
    ).toEqual([]);
    // Sanity check that the walk found routes at all, so an empty glob cannot
    // make this test vacuously pass.
    expect(routes.length).toBeGreaterThanOrEqual(20);
  });
});

describe("gitignore cannot swallow nested source directories", () => {
  it("anchors build-output patterns to the repository root", () => {
    const check = (candidate: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", candidate], { cwd: REPO_ROOT });
        return true;
      } catch {
        return false;
      }
    };

    // Nested directories that merely share a name with build output must not be
    // ignored. These are real route paths in this application.
    expect(check("src/app/api/panta/trade/build/route.ts")).toBe(false);
    expect(check("src/app/api/panta/create/build/route.ts")).toBe(false);
    expect(check("src/app/api/panta/claims/winnings/build/route.ts")).toBe(false);
    expect(check("src/app/api/panta/claims/creator-fees/build/route.ts")).toBe(false);

    // Genuine build output and secrets must still be ignored.
    expect(check("node_modules/anything")).toBe(true);
    expect(check(".next/anything")).toBe(true);
    expect(check(".env.local")).toBe(true);
  });
});
