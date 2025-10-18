#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const specsDir = path.join(repoRoot, "src", "connectors", "openapi-specs");
const outDir = path.join(repoRoot, "src", "connectors", "client-schemas");

function toPascalCase(str) {
  return str
    .replace(/(^|[-_.\s]+)([a-zA-Z0-9])/g, (_, __, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

async function run() {
  if (!fs.existsSync(specsDir)) {
    console.error(`OpenAPI specs directory not found: ${specsDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  let files = fs
    .readdirSync(specsDir)
    .filter((f) => /\.ya?ml$|\.json$/i.test(f));

  if (files.length === 0) {
    console.warn(`No OpenAPI spec files found in ${specsDir}`);
    process.exit(0);
  }

  console.log(`Found ${files.length} spec(s) in ${specsDir}.`);

  // Helper to parse a user selection like "1,3-5,7" into zero-based indices
  function parseSelection(input, max) {
    const seen = new Set();
    const parts = input
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        const n = Number(part);
        if (n >= 1 && n <= max) seen.add(n - 1);
        continue;
      }
      const m = part.match(/^(\d+)-(\d+)$/);
      if (m) {
        let a = Number(m[1]);
        let b = Number(m[2]);
        if (a > b) [a, b] = [b, a];
        for (let i = a; i <= b; i++) {
          if (i >= 1 && i <= max) seen.add(i - 1);
        }
        continue;
      }
      // allow filenames directly
      const idx = files.indexOf(part);
      if (idx !== -1) seen.add(idx);
    }
    return Array.from(seen).sort((a, b) => a - b);
  }

  // Prompt the user to choose which files to generate
  async function promptUserToSelectFiles(files) {
    // If not a TTY (CI or piping), default to all files
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(
        "Non-interactive shell detected; defaulting to generating all specs.",
      );
      return files.slice();
    }

    // If only one file exists, auto-select it
    if (files.length === 1) {
      console.log(
        `Only one spec found: ${files[0]} — selecting it automatically.`,
      );
      return files.slice();
    }

    console.log("Available OpenAPI spec files:");
    files.forEach((f, i) => {
      console.log(`  ${String(i + 1).padStart(2, " ")}. ${f}`);
    });
    console.log(
      '\nEnter numbers (e.g. "1,3-5"), filenames, or "all" to generate for all files. Leave blank to cancel.',
    );

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question("Select files to generate: ", (ans) => {
        rl.close();
        resolve(String(ans || "").trim());
      });
    });

    if (!answer) {
      console.log("No selection made — aborting.");
      process.exit(0);
    }

    if (/^all$|^\*$|^a$/i.test(answer)) {
      return files.slice();
    }

    const indices = parseSelection(answer, files.length);
    if (indices.length === 0) {
      console.log("No valid selections parsed — aborting.");
      process.exit(0);
    }
    return indices.map((i) => files[i]);
  }

  files = await promptUserToSelectFiles(files);

  console.log(`Generating types to ${outDir}`);

  // Try to use the programmatic API if available so we can capture errors directly.
  let openapiTS = null;
  try {
    const mod = require("openapi-typescript");
    openapiTS = mod && (mod.default || mod);
  } catch (err) {
    // Not installed locally — we'll fall back to CLI later.
    console.warn(
      "openapi-typescript not available as a module; falling back to CLI (npx). Install devDependencies to use the programmatic API.",
    );
  }

  // Try to use swagger2openapi to convert swagger 2.0 specs -> openapi 3.x for the programmatic API.
  let swagger2openapi = null;
  try {
    swagger2openapi = require("swagger2openapi");
  } catch (err) {
    // Not critical — if conversion isn't available we'll try the CLI which may do conversion.
    // Do not warn loudly here, the programmatic API will simply fail and the CLI fallback will be attempted.
  }

  const generated = [];
  let hadFailures = false;

  for (const file of files) {
    const inputPath = path.join(specsDir, file);
    const base = path.basename(file, path.extname(file));
    const outFile = path.join(outDir, `${base}.ts`);

    console.log(
      `\nGenerating ${path.relative(repoRoot, outFile)} from ${path.relative(repoRoot, inputPath)}...`,
    );

    // Try programmatic API first
    if (openapiTS) {
      try {
        // Read and parse the spec so we can deduplicate operationIds before handing it off.
        let rawSpec = null;
        let parsedSpec = null;
        const ext = path.extname(inputPath).toLowerCase();
        try {
          rawSpec = fs.readFileSync(inputPath, "utf8");
        } catch (e) {
          rawSpec = null;
        }

        // Try JSON parse first, fallback to YAML
        try {
          parsedSpec = rawSpec ? JSON.parse(rawSpec) : null;
        } catch (e) {
          try {
            const yaml = require("js-yaml");
            parsedSpec = rawSpec ? yaml.load(rawSpec) : null;
          } catch (e2) {
            parsedSpec = null;
          }
        }

        // Deduplicate operationIds when present
        const operationIdMap = {};
        if (parsedSpec && parsedSpec.paths) {
          const seen = Object.create(null);
          for (const [p, methods] of Object.entries(parsedSpec.paths)) {
            if (methods && typeof methods === "object") {
              for (const [verb, op] of Object.entries(methods)) {
                if (!op || typeof op !== "object") continue;
                if (!op.operationId) continue;
                const original = String(op.operationId);
                let candidate = original;
                if (!seen[candidate]) {
                  seen[candidate] = 1;
                } else {
                  // append suffix until unique
                  let idx = ++seen[candidate];
                  candidate = `${original}_${idx}`;
                  while (seen[candidate]) {
                    idx = ++seen[candidate];
                    candidate = `${original}_${idx}`;
                  }
                  seen[candidate] = 1;
                }
                if (candidate !== original) {
                  operationIdMap[original] = operationIdMap[original] || [];
                  operationIdMap[original].push(candidate);
                  op.operationId = candidate;
                }
              }
            }
          }
        }

        // If the spec is Swagger 2.0 and we have a converter, convert it to OpenAPI 3.x first.
        let useInput = inputPath;
        let converted = null;
        if (
          parsedSpec &&
          parsedSpec.swagger &&
          String(parsedSpec.swagger).startsWith("2") &&
          swagger2openapi
        ) {
          try {
            // If we've already parsed the spec, convert the parsed object
            const res = await new Promise((resolve, reject) => {
              swagger2openapi.convertObj(
                parsedSpec,
                { patch: true },
                (err, out) => (err ? reject(err) : resolve(out)),
              );
            });
            converted = res && (res.openapi || res);
          } catch (e) {
            converted = null;
          }
        } else if (ext !== ".json" && swagger2openapi) {
          // For YAML specs, try convertFile if available (it will read and parse the file)
          try {
            const res = await new Promise((resolve, reject) => {
              swagger2openapi.convertFile(
                inputPath,
                { patch: true },
                (err, out) => (err ? reject(err) : resolve(out)),
              );
            });
            converted = res && (res.openapi || res);
          } catch (e) {
            converted = null;
          }
        }

        if (Object.keys(operationIdMap).length > 0) {
          // If we mutated operationIds, write a small mapping file for the user to inspect
          const mapPath = outFile + ".operationid-map.json";
          fs.writeFileSync(
            mapPath,
            JSON.stringify(operationIdMap, null, 2),
            "utf8",
          );
          console.log(
            `Wrote operationId mapping to ${path.relative(repoRoot, mapPath)}`,
          );
        }

        if (converted) {
          // We have an in-memory OpenAPI 3 object — pass it to the programmatic API
          // If we previously deduplicated operationIds on parsedSpec, ensure we pass converted or mutated spec.
          const specToUse = converted || parsedSpec || inputPath;
          const ts = await openapiTS(specToUse);
          fs.writeFileSync(outFile, ts, "utf8");
          console.log(
            `Wrote ${path.relative(repoRoot, outFile)} (converted from swagger 2.0)`,
          );
          generated.push({ file: base, outFile });
          continue;
        }

        // Otherwise just try the programmatic API directly with the input path (works for OpenAPI 3.x)
        const ts = await openapiTS(useInput);
        fs.writeFileSync(outFile, ts, "utf8");
        console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
        generated.push({ file: base, outFile });
        continue;
      } catch (err) {
        console.error(
          `Programmatic openapi-typescript failed for ${file}: ${err && err.message ? err.message : err}`,
        );
        if (err && err.stack) {
          console.error(err.stack);
        }
        // write a helpful error log next to the intended output
        try {
          fs.writeFileSync(
            outFile + ".error.log",
            String(err && (err.stack || err.message || err)),
            "utf8",
          );
          console.error(
            `Wrote error log to ${path.relative(repoRoot, outFile + ".error.log")}`,
          );
        } catch (e) {
          console.error(
            "Failed to write error log:",
            e && e.message ? e.message : e,
          );
        }
        console.log("Attempting CLI fallback via npx...");
        // fallthrough to CLI fallback
      }
    }

    // CLI fallback: call npx openapi-typescript <input> --output <out>
    try {
      const { spawnSync } = require("child_process");

      // Prefer a locally installed binary at node_modules/.bin when available.
      const localBinName =
        process.platform === "win32"
          ? "openapi-typescript.cmd"
          : "openapi-typescript";
      const localBin = path.join(
        repoRoot,
        "node_modules",
        ".bin",
        localBinName,
      );
      let res;

      if (fs.existsSync(localBin)) {
        console.log(
          `Using local openapi-typescript binary: ${path.relative(repoRoot, localBin)}`,
        );
        // Use shell on Windows to allow .cmd to be executed correctly
        res = spawnSync(localBin, [inputPath, "--output", outFile], {
          encoding: "utf8",
          shell: process.platform === "win32",
        });
      } else {
        const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
        const args = ["openapi-typescript", inputPath, "--output", outFile];
        res = spawnSync(cmd, args, { encoding: "utf8" });
      }

      if (res.error) {
        console.error(`Failed to run CLI for ${file}: ${res.error.message}`);
        fs.appendFileSync(
          outFile + ".error.log",
          `\nCLI error: ${String(res.error && (res.error.stack || res.error.message || res.error))}\n`,
          "utf8",
        );
        hadFailures = true;
        continue;
      }

      if (res.stdout) process.stdout.write(res.stdout);
      if (res.stderr) process.stderr.write(res.stderr);

      if (res.status !== 0) {
        console.error(
          `CLI generation failed for ${file} (exit code ${res.status}).`,
        );
        fs.appendFileSync(
          outFile + ".error.log",
          `\nCLI output:\n${res.stdout || ""}\n${res.stderr || ""}\n`,
          "utf8",
        );
        hadFailures = true;
        continue;
      }

      generated.push({ file: base, outFile });
    } catch (err) {
      console.error(
        `Unexpected error while running CLI fallback for ${file}: ${err && err.message ? err.message : err}`,
      );
      if (err && err.stack) console.error(err.stack);
      try {
        fs.appendFileSync(
          outFile + ".error.log",
          `\nUnexpected CLI fallback error:\n${String(err && (err.stack || err.message || err))}\n`,
          "utf8",
        );
      } catch (e) {
        console.error(
          "Failed to write error log:",
          e && e.message ? e.message : e,
        );
      }
      hadFailures = true;
    }
  }

  // Create (or update) an index.ts that re-exports generated schemas
  const indexPath = path.join(outDir, "index.ts");
  const indexLines =
    generated
      .map((g) => `export * as ${toPascalCase(g.file)} from './${g.file}';`)
      .join("\n") + "\n";

  fs.writeFileSync(indexPath, indexLines, "utf8");
  console.log(
    `\nWrote ${path.relative(repoRoot, indexPath)} with ${generated.length} exports.`,
  );

  if (hadFailures) {
    console.error(
      "Some specs failed to generate — check the corresponding .error.log files and the console output above.",
    );
    process.exit(2);
  }

  console.log("\nAll done.");
}

run().catch((err) => {
  console.error(
    "Unexpected error while generating OpenAPI types:",
    err && (err.stack || err.message) ? err.stack || err.message : err,
  );
  process.exit(1);
});
