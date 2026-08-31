/*
 * Extrai 1 frame (a ~40% da duracao, 480px de largura) e as dimensoes de cada
 * .mp4 da biblioteca de B-rolls, e monta contact-sheets de 25 pra revisao.
 *
 * Saida em scratch/: frames PNG, _dims.json (nome -> {w,h}), sheet-NN.png.
 * Uso: node scripts/frames.mjs "C:\\Users\\leogi\\Downloads\\Brolls - 2026"
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { join, basename } from "node:path";

const run = promisify(execFile);
const lib = process.argv[2] ?? "C:\\Users\\leogi\\Downloads\\Brolls - 2026";
const out = join(process.cwd(), "scratch");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });

const arquivos = (await readdir(lib)).filter((f) => f.toLowerCase().endsWith(".mp4")).sort();
const dims = {};

for (const f of arquivos) {
  const src = join(lib, f);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,duration",
    "-of", "json", src,
  ]);
  const s = JSON.parse(stdout).streams[0];
  dims[f] = { w: Number(s.width), h: Number(s.height) };
  const ss = Math.max(0.1, (Number(s.duration) || 5) * 0.4).toFixed(2);
  await run("ffmpeg", [
    "-v", "error", "-ss", ss, "-i", src, "-frames:v", "1",
    "-vf", "scale=480:-1", "-y",
    join(out, "frames", basename(f, ".mp4") + ".png"),
  ]);
  process.stdout.write(".");
}
await writeFile(join(out, "_dims.json"), JSON.stringify(dims, null, 2));

// contact-sheets de 25 (5x5). O demuxer concat com PNG so emite 1 frame de
// forma confiavel, entao copio cada lote pra uma sequencia numerada, ja
// escalado e com pad uniforme (as origens variam de 464x832 a 720x1280), e
// deixo o image2 + tile fazerem a grade.
const CEL_W = 220;
const CEL_H = 391; // 9:16 aprox
const seq = join(out, "seq");
for (let i = 0; i < arquivos.length; i += 25) {
  await rm(seq, { recursive: true, force: true });
  await mkdir(seq, { recursive: true });
  const lote = arquivos.slice(i, i + 25);
  const sheetN = String(i / 25).padStart(2, "0");
  // lista dos nomes na ordem da grade (linha por linha, 5 por linha)
  await writeFile(
    join(out, `sheet-${sheetN}.txt`),
    lote.map((f, k) => `${String(k + 1).padStart(2, " ")}. ${f}`).join("\n"),
  );
  for (let k = 0; k < lote.length; k++) {
    await run("ffmpeg", [
      "-v", "error", "-i", join(out, "frames", basename(lote[k], ".mp4") + ".png"),
      "-vf",
      `scale=${CEL_W}:${CEL_H}:force_original_aspect_ratio=decrease,` +
        `pad=${CEL_W}:${CEL_H}:(ow-iw)/2:(oh-ih)/2:color=#202020`,
      "-y", join(seq, `${String(k).padStart(2, "0")}.png`),
    ]);
  }
  await run("ffmpeg", [
    "-v", "error", "-framerate", "1", "-i", join(seq, "%02d.png"),
    "-frames:v", "1", "-vf", "tile=5x5:padding=6:margin=6:color=#101010", "-y",
    join(out, `sheet-${String(i / 25).padStart(2, "0")}.png`),
  ]);
}
await rm(seq, { recursive: true, force: true });
console.log(`\n${arquivos.length} arquivos, ${Math.ceil(arquivos.length / 25)} sheets em ${out}`);
