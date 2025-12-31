import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {{ includeSrc: boolean }} CliArgs
 * @typedef {{ ns: string; key: string; filePath: string }} UsedKey
 * @typedef {{ __parseError: string }} ParseErrorSentinel
 * @typedef {{ lng: string; ns: string; file: string; error: string }} ParseError
 */

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const DEFAULT_NS = "common";
const NAMESPACES = ["common", "auth", "chat", "navigation", "profile"];

const frontendRoot = path.join(repoRoot, "frontend");
const frontendSrcRoot = path.join(repoRoot, "frontend", "src");

/** @param {string[]} argv @returns {CliArgs} */
function parseArgs(argv) {
  const out = {
    includeSrc: false,
  };
  for (const a of argv) {
    if (a === "--include-src") out.includeSrc = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const FRONTEND_DIRS = args.includeSrc
  ? [frontendRoot, frontendSrcRoot]
  : [frontendRoot];

/** @param {string} p @returns {boolean} */
function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** @param {string} filePath @returns {any} */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** @param {string} localesRoot @returns {string[]} */
function listLanguages(localesRoot) {
  if (!isDirectory(localesRoot)) return [];
  return fs
    .readdirSync(localesRoot)
    .filter((name) => isDirectory(path.join(localesRoot, name)))
    .sort();
}

/** @param {Record<string, any> | null | undefined} obj @param {string} dottedKey @returns {boolean} */
function hasPath(obj, dottedKey) {
  const parts = dottedKey.split(".");
  /** @type {any} */
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

/** @param {string} rootDir @returns {string[]} */
function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  const ignoredDirNames = new Set([
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "locales",
    ".git",
  ]);

  // Não mistura arquivos de /frontend e /frontend/src
  if (path.basename(rootDir) === "frontend") {
    ignoredDirNames.add("src");
  }

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (ignoredDirNames.has(ent.name)) continue;
        stack.push(p);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;
      out.push(p);
    }
  }

  return out;
}

/** @param {string} key @returns {boolean} */
function looksLikeTranslationKey(key) {
  return /^[A-Za-z0-9_.-]+$/.test(key);
}

/** @param {string} filePath @returns {UsedKey[]} */
function extractKeysFromFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");

  const looksLikeI18nFile =
    src.includes("useTranslation") ||
    src.includes("react-i18next") ||
    src.includes("i18next") ||
    src.includes("initReactI18next");

  // Heurística simples: pega o(s) namespace(s) do primeiro useTranslation("ns")
  // (se não existir, cai em DEFAULT_NS)
  let fileDefaultNs = DEFAULT_NS;
  const useTranslationSingle = src.match(
    /useTranslation\(\s*(['"])([^'"]+)\1\s*\)/,
  );
  if (useTranslationSingle?.[2]) fileDefaultNs = useTranslationSingle[2];

  const useTranslationArray = src.match(/useTranslation\(\s*\[([^\]]+)\]\s*\)/);
  if (useTranslationArray?.[1]) {
    const nsMatches = [
      ...useTranslationArray[1].matchAll(/(['"])([^'"]+)\1/g),
    ].map((m) => m[2]);
    if (nsMatches.length === 1) fileDefaultNs = nsMatches[0];
    // Se tiver vários, mantém DEFAULT_NS (ambíguo)
  }

  /** @type {UsedKey[]} */
  const keys = [];

  // i18n.t("...") com primeiro argumento string literal
  const reI18n = /\bi18n\.t\(\s*(['"`])([^'"`]+?)\1/g;
  for (const match of src.matchAll(reI18n)) {
    const quote = match[1];
    const raw = match[2];
    if (quote === "`" && raw.includes("${")) continue;

    const idx = raw.indexOf(":");
    if (idx > 0) {
      const ns = raw.slice(0, idx);
      const key = raw.slice(idx + 1);
      if (!looksLikeTranslationKey(key)) continue;
      keys.push({ ns, key, filePath });
    } else {
      if (!looksLikeTranslationKey(raw)) continue;
      keys.push({ ns: fileDefaultNs, key: raw, filePath });
    }
  }

  // t("...") com primeiro argumento string literal (apenas em arquivos com cara de i18n)
  if (looksLikeI18nFile) {
    const reT = /\bt\(\s*(['"`])([^'"`]+?)\1/g;
    for (const match of src.matchAll(reT)) {
      const quote = match[1];
      const raw = match[2];
      if (quote === "`" && raw.includes("${")) continue;

      const idx = raw.indexOf(":");
      if (idx > 0) {
        const ns = raw.slice(0, idx);
        const key = raw.slice(idx + 1);
        if (!looksLikeTranslationKey(key)) continue;
        keys.push({ ns, key, filePath });
      } else {
        if (!looksLikeTranslationKey(raw)) continue;
        keys.push({ ns: fileDefaultNs, key: raw, filePath });
      }
    }
  }

  return keys;
}

/** @param {string} baseDir @returns {string} */
function resolveLocalesRoot(baseDir) {
  // O código em `frontend/src` usa alias `@/locales/...` (raiz do projeto Next),
  // então as traduções "de verdade" ficam em `frontend/locales`.
  if (path.resolve(baseDir) === path.resolve(frontendSrcRoot)) {
    return path.join(frontendRoot, "locales");
  }
  return path.join(baseDir, "locales");
}

/**
 * @param {string} baseDir
 * @returns {{ langs: string[]; resources: Record<string, Record<string, any | null | ParseErrorSentinel>>; localesRoot: string }}
 */
function loadResources(baseDir) {
  const localesRoot = resolveLocalesRoot(baseDir);
  const langs = listLanguages(localesRoot);

  /** @type {Record<string, Record<string, any | null | ParseErrorSentinel>>} */
  const resources = {};
  for (const lng of langs) {
    resources[lng] = {};
    for (const ns of NAMESPACES) {
      const p = path.join(localesRoot, lng, `${ns}.json`);
      if (fs.existsSync(p)) {
        try {
          resources[lng][ns] = readJson(p);
        } catch (e) {
          resources[lng][ns] = { __parseError: String(e) };
        }
      } else {
        resources[lng][ns] = null;
      }
    }
  }

  return { langs, resources, localesRoot };
}

/**
 * @param {string} baseDir
 * @returns {{ baseDir: string; langs: string[]; missing: Record<string, Record<string, string[]>>; parseErrors: ParseError[]; totalKeys: number; localesRoot: string } | null}
 */
function auditBaseDir(baseDir) {
  const { langs, resources, localesRoot } = loadResources(baseDir);
  if (!langs.length) return null;

  const files = walkFiles(baseDir);
  /** @type {UsedKey[]} */
  const used = [];
  for (const f of files) {
    // Não varrer o próprio script
    if (f.includes(`${path.sep}scripts${path.sep}`)) continue;
    used.push(...extractKeysFromFile(f));
  }

  // dedup
  const uniq = new Map();
  for (const u of used) {
    const k = `${u.ns}:${u.key}`;
    if (!uniq.has(k)) uniq.set(k, u);
  }

  /** @type {Record<string, Record<string, string[]>>} */
  const missing = {}; // lng -> ns -> keys[]
  /** @type {ParseError[]} */
  const parseErrors = [];

  for (const lng of langs) {
    missing[lng] = {};
    for (const ns of NAMESPACES) {
      const res = resources[lng][ns];
      if (res && typeof res === "object" && "__parseError" in res) {
        parseErrors.push({
          lng,
          ns,
          file: path.join(localesRoot, lng, `${ns}.json`),
          error: res.__parseError,
        });
      }
    }
  }

  for (const { ns, key } of uniq.values()) {
    if (!NAMESPACES.includes(ns)) continue;
    for (const lng of langs) {
      const res = resources[lng][ns];
      const ok = res && typeof res === "object" && hasPath(res, key);
      if (!ok) {
        if (!missing[lng][ns]) missing[lng][ns] = [];
        missing[lng][ns].push(key);
      }
    }
  }

  // Limpa vazios
  for (const lng of langs) {
    for (const ns of Object.keys(missing[lng])) {
      if (!missing[lng][ns].length) delete missing[lng][ns];
      else missing[lng][ns].sort();
    }
    if (!Object.keys(missing[lng]).length) delete missing[lng];
  }

  return {
    baseDir,
    langs,
    missing,
    parseErrors,
    totalKeys: uniq.size,
    localesRoot,
  };
}

function main() {
  const reports = [];
  for (const baseDir of FRONTEND_DIRS) {
    const r = auditBaseDir(baseDir);
    if (r) reports.push(r);
  }

  if (!reports.length) {
    console.log("Nenhum frontend/locales encontrado.");
    process.exit(0);
  }

  for (const r of reports) {
    console.log(`\n== Audit: ${path.relative(repoRoot, r.baseDir)} ==`);
    console.log(`Locales: ${path.relative(repoRoot, r.localesRoot)}`);
    console.log(`Keys únicos encontrados: ${r.totalKeys}`);

    if (r.parseErrors.length) {
      console.log("\nArquivos JSON com erro de parse:");
      for (const e of r.parseErrors) {
        console.log(
          `- ${path.relative(repoRoot, e.file)} (${e.lng}/${e.ns}): ${e.error}`,
        );
      }
    }

    const lngs = Object.keys(r.missing).sort();
    if (!lngs.length) {
      console.log(
        '\nOK: nenhuma chave faltando (para as chaves detectadas via t("...")).',
      );
      continue;
    }

    console.log("\nChaves faltantes:");
    for (const lng of lngs) {
      console.log(`\n- ${lng}`);
      const byNs = r.missing[lng];
      for (const ns of Object.keys(byNs).sort()) {
        console.log(`  - ${ns}: ${byNs[ns].length}`);
        for (const k of byNs[ns]) console.log(`    - ${k}`);
      }
    }
  }
}

main();
