/**
 * check-build-scripts.mjs — fail if the build depends on untracked files.
 *
 * This exists because of a real, repeated failure. `.gitignore` once ignored
 * scripts/*.mjs as a blanket rule. A new build script, gen-sitemap.mjs, matched
 * it, was never committed, and every Vercel deploy died with:
 *
 *   Error: Cannot find module '/vercel/path0/scripts/gen-sitemap.mjs'
 *
 * An untracked build script is invisible locally — everything works on the
 * machine that has it — and only breaks in a fresh clone. So this check reads
 * package.json, extracts every script path the build and dev flow reference,
 * and verifies each one is actually tracked by git. Untracked files are listed
 * by name, so the fix is obvious.
 *
 * Wired into `prebuild`, so it runs before every build.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** Collect referenced script paths from a command string. */
function referencedPaths(command) {
  const out = new Set();
  if (!command) return out;
  for (const m of command.matchAll(/(?:^|[\s&|;])(?:node\s+)?([\w./-]+\.(?:mjs|cjs|js|ts))/g)) {
    out.add(m[1]);
  }
  return out;
}

const scripts = pkg.scripts || {};

// Only the flows that must work in a fresh clone: the build, and the dev server
// config. pre/post hooks are included because they wrap the build.
const critical = new Map();
for (const [name, cmd] of Object.entries(scripts)) {
  if (!/^(pre|post)?build$|^dev$|^preview$/.test(name)) continue;
  for (const p of referencedPaths(cmd)) critical.set(p, name);
}

if (critical.size === 0) {
  console.log("check-build-scripts: nothing to verify");
  process.exit(0);
}

const missingOnDisk = [];
const untracked = [];

for (const [rel, from] of critical) {
  if (!existsSync(join(root, rel))) {
    missingOnDisk.push(`${rel}  (referenced by "${from}")`);
    continue;
  }
  let tracked = true;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", rel], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    tracked = false;
  }
  if (!tracked) untracked.push(`${rel}  (referenced by "${from}")`);
}

if (missingOnDisk.length === 0 && untracked.length === 0) {
  console.log(
    `check-build-scripts: ${critical.size} build script(s) present and tracked`
  );
  process.exit(0);
}

console.error("\n  ############################################################");
console.error("  #  check-build-scripts: FAILED                              #");
if (missingOnDisk.length) {
  console.error("  #                                                          #");
  console.error("  #  Referenced by package.json but missing on disk:          #");
  for (const m of missingOnDisk) console.error(`  #    - ${m}`);
}
if (untracked.length) {
  console.error("  #                                                          #");
  console.error("  #  Present on disk but NOT tracked by git. A fresh clone     #");
  console.error("  #  (Vercel, CI, another machine) will fail to build:        #");
  for (const u of untracked) console.error(`  #    - ${u}`);
  console.error("  #                                                          #");
  console.error("  #  Fix with:  git add -f <path>                             #");
  console.error("  #  then check .gitignore for a rule that hides it.          #");
}
console.error("  ############################################################\n");
process.exit(1);
