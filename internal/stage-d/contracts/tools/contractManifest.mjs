/**
 * Stage D.4.2 — Contract Manifest & Drift Detection
 *
 * Deterministic contract hashing + CI enforcement.
 * - Stable across OS: normalizes line endings + whitespace.
 * - Stable ordering: lexicographic file list.
 * - Uses SHA-256 on normalized UTF-8 bytes.
 *
 * Usage:
 *   node internal/stage-d/contracts/tools/contractManifest.mjs check
 *   node internal/stage-d/contracts/tools/contractManifest.mjs update
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CONFIG_PATH = "internal/stage-d/contracts/contract-manifest.config.json";
const MANIFEST_PATH = "internal/stage-d/contracts/contract-manifest.json";

function fail(msg) {
  console.error(`\n[Stage D.4.2] FAIL: ${msg}\n`);
  process.exit(1);
}

function readJson(p) {
  if (!fs.existsSync(p)) fail(`Missing required file: ${p}`);
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    fail(`Invalid JSON: ${p}`);
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isWithinExtensions(filePath, exts) {
  const ext = path.extname(filePath).toLowerCase();
  return exts.includes(ext);
}

// Deterministic include/exclude matching (prefix-scope). No regex globbing.


function patternBase(patternPosix) {
  const star = patternPosix.indexOf("*");
  const base = star === -1 ? patternPosix : patternPosix.slice(0, star);
  // Trim trailing "/" so prefix match behaves correctly.
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function pathStartsWith(filePathPosix, basePosix) {
  return filePathPosix === basePosix || filePathPosix.startsWith(basePosix + "/");
}

function matchesPattern(filePathPosix, patternPosix) {
  if (!patternPosix) return false;

  // No glob chars => exact match
  if (!patternPosix.includes("*")) {
    return filePathPosix === patternPosix;
  }

  // Has glob chars => prefix scope match
  const base = patternBase(patternPosix);
  if (!base) return false;

  return pathStartsWith(filePathPosix, base);
}

function shouldInclude(filePathPosix, cfg) {
  if (!isWithinExtensions(filePathPosix, cfg.extensions)) return false;

  const included = cfg.include.some((pat) => matchesPattern(filePathPosix, pat));
  if (!included) return false;

  const excluded = cfg.exclude.some((pat) => matchesPattern(filePathPosix, pat));
  if (excluded) return false;

  return true;
}

function walkFiles(rootAbs) {
  const out = [];

  function walk(dirAbs) {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dirAbs, e.name);
      if (e.isDirectory()) {
        // quick skip common large dirs
        if (
          e.name === "node_modules" ||
          e.name === ".git" ||
          e.name === ".next" ||
          e.name === "dist" ||
          e.name === "build"
        ) {
          continue;
        }
        walk(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }

  walk(rootAbs);
  return out;
}

function normalizeText(input, n) {
  let s = input;

  // Normalize CRLF/CR to LF
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (n.trimTrailingWhitespace) {
    s = s
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n");
  }

  if (n.collapseFinalNewlines) {
    // Ensure exactly one newline at EOF for determinism
    s = s.replace(/\n+$/g, "\n");
  }

  return s;
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function buildManifest(cfg) {
  const rootAbs = path.resolve(cfg.root);
  if (!fs.existsSync(rootAbs)) fail(`Config root does not exist: ${cfg.root}`);

  const allAbs = walkFiles(rootAbs);

  const filesRelPosix = allAbs
    .map((abs) => toPosix(path.relative(rootAbs, abs)))
    .filter((rel) => rel && shouldInclude(rel, cfg))
    .sort((a, b) => a.localeCompare(b));

  const entries = filesRelPosix.map((rel) => {
    const abs = path.join(rootAbs, rel.split("/").join(path.sep));
    const raw = fs.readFileSync(abs, "utf8");
    const norm = normalizeText(raw, cfg.normalization);
    const buf = Buffer.from(norm, "utf8");

    return {
      path: rel,
      sha256: sha256Hex(buf),
      bytes: buf.byteLength,
    };
  });

  const compositeInput = entries.map((e) => `${e.path}\0${e.sha256}\0${e.bytes}\n`).join("");
  const compositeSha256 = sha256Hex(Buffer.from(compositeInput, "utf8"));

  return {
    manifestVersion: cfg.version,
    generatedAtUtc: new Date().toISOString(),
    root: cfg.root,
    algorithm: "sha256",
    normalization: cfg.normalization,
    fileCount: entries.length,
    files: entries,
    compositeSha256,
  };
}

function stableStringify(obj) {
  // Deterministic JSON output: stable key ordering.
  const seen = new WeakSet();

  function sortValue(v) {
    if (v === null) return null;
    if (typeof v !== "object") return v;

    if (Array.isArray(v)) return v.map((item) => sortValue(item));

    if (seen.has(v)) fail("Cyclic structure in manifest (should be impossible).");
    seen.add(v);

    const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
    const out = {};
    for (const k of keys) out[k] = sortValue(v[k]);
    return out;
  }

  return JSON.stringify(sortValue(obj), null, 2) + "\n";
}

function loadExpectedManifest() {
  return readJson(MANIFEST_PATH);
}

function writeManifest(m) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, stableStringify(m), "utf8");
}

function diffSummary(expected, actual) {
  const out = [];

  const expMap = new Map(expected.files.map((f) => [f.path, f]));
  const actMap = new Map(actual.files.map((f) => [f.path, f]));

  const allPaths = Array.from(new Set([...expMap.keys(), ...actMap.keys()])).sort((a, b) =>
    a.localeCompare(b)
  );

  const added = [];
  const removed = [];
  const changed = [];

  for (const p of allPaths) {
    const e = expMap.get(p);
    const a = actMap.get(p);
    if (!e && a) added.push(p);
    else if (e && !a) removed.push(p);
    else if (e && a && (e.sha256 !== a.sha256 || e.bytes !== a.bytes)) changed.push(p);
  }

  if (expected.compositeSha256 !== actual.compositeSha256) out.push("Composite hash changed.");
  if (added.length) out.push(`Added files (${added.length}):\n  - ${added.join("\n  - ")}`);
  if (removed.length) out.push(`Removed files (${removed.length}):\n  - ${removed.join("\n  - ")}`);
  if (changed.length) out.push(`Changed files (${changed.length}):\n  - ${changed.join("\n  - ")}`);

  return out;
}

function main() {
  const cmd = process.argv[2];
  if (!cmd || !["check", "update"].includes(cmd)) {
    console.log("Usage: node internal/stage-d/contracts/tools/contractManifest.mjs <check|update>");
    process.exit(0);
  }

  const cfg = readJson(CONFIG_PATH);
  const actual = buildManifest(cfg);

  if (cmd === "update") {
    writeManifest(actual);
    console.log(`[Stage D.4.2] Updated manifest: ${MANIFEST_PATH}`);
    console.log(`[Stage D.4.2] File count: ${actual.fileCount}`);
    console.log(`[Stage D.4.2] Composite SHA-256: ${actual.compositeSha256}`);
    return;
  }

  const expected = loadExpectedManifest();

  if (expected.algorithm !== "sha256") fail(`Unexpected algorithm in expected manifest: ${expected.algorithm}`);
  if (expected.manifestVersion !== cfg.version)
    fail(`Expected manifestVersion ${cfg.version}, found ${expected.manifestVersion}`);
  if (expected.root !== cfg.root) fail(`Expected root ${cfg.root}, found ${expected.root}`);

  if (expected.compositeSha256 !== actual.compositeSha256) {
    const lines = diffSummary(expected, actual);
    console.error("[Stage D.4.2] Contract drift detected.\n");
    for (const l of lines) console.error(l + "\n");
    fail(`Contracts drifted vs ${MANIFEST_PATH}. If intentional, run: npm run contracts:manifest:update`);
  }

  console.log(`[Stage D.4.2] OK — contract manifest matches (${actual.fileCount} files).`);
}

main();
