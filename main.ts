// Sizzle & Serve — the hand-in program (Node 22, standard library only).
//
// The game is the static files under game/ next to this file, and its four
// screenshots sit in screenshots/. This program copies both into the output
// directory and writes dossier.json there with the vendored make.fun library,
// so the sealed scorer can check the entry byte for byte.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Where this file lives: the repository root, beside game/ and screenshots/. */
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
/** The grader's /output, or MAKEFUN_OUTPUT_DIR when running it by hand. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The gate's own caps, so this program refuses an entry the scorer would. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/**
 * Copy a directory tree file by file, creating directories as needed, and
 * leave every entry world-readable: directories 0755, files 0644. The copy
 * is deterministic — same inputs, same bytes — so the grader's two runs agree.
 */
function copyTree(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  chmodSync(targetDir, 0o755);
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const from = join(sourceDir, entry.name);
    const to = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      writeFileSync(to, readFileSync(from));
      chmodSync(to, 0o644);
    }
    // Anything else (a symlink, a device) is left out: game/ holds plain files.
  }
}

function prepareOutput() {
  const gameDir = join(repoRoot, 'game');
  if (!statSync(gameDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('game/: no such directory — the game is the static files under game/');
  }
  mkdirSync(outputDir, { recursive: true });
  copyTree(gameDir, join(outputDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

prepareOutput();
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(dossierPath, buildDossier(outputDir, DOSSIER_CAPS));
chmodSync(dossierPath, 0o644);
