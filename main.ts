// Sunset Press Cover Studio — the hand-in program for gta6-cover-art-01.
//
// The app itself is the static site under app/ (open app/index.html in a
// browser; it runs fully offline). This program's only job is to hand that
// site in the way the bounty asks: copy app/ and screenshots/ into the
// output directory and write dossier.json there with the kit's vendored
// buildDossier, byte for byte the library the scorer uses.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR naming the
// output directory outside the grader's container:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });

const screenshotsDir = join(outputDir, 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), screenshotsDir, { recursive: true });
}

// The caps below are the gate's own (the kit's reference/gate.json): the
// dossier text cap, at most 4 screenshots of at most 256 KiB, at most 993
// app entries and 48 MiB of app files, no app path over 1,000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
