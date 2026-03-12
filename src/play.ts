import { spawn } from "child_process";
import { mkdir, unlink, writeFile } from "fs/promises";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { getPreferenceValues } from "@raycast/api";
import { ensureToolingInPath } from "./path-utils";
import { Preferences } from "./types";

const cleanupTimeouts = new Set<NodeJS.Timeout>();
let ffmpegAvailableCache: boolean | null = null;

export async function play(audio: Buffer, sourceFormat: string): Promise<void> {
  const preferences = getPreferenceValues<Preferences>();
  const shouldSave = preferences.saveAudioFiles || false;
  const desiredOutputFormat = preferences.outputFormat || sourceFormat;
  const desiredSpeed = parseSpeed(preferences.speed);
  let outputFormat: string = desiredOutputFormat;
  let speed = desiredSpeed;
  let needsTranscode = outputFormat !== sourceFormat || speed !== 1;

  const audioDir = join(homedir(), ".cache", "raycast-tts");
  if (shouldSave) {
    await mkdir(audioDir, { recursive: true });
  }

  const inputIsTemporary = !shouldSave || needsTranscode;
  const inputPath = inputIsTemporary
    ? join(tmpdir(), `tts-${Date.now()}.${sourceFormat}`)
    : join(audioDir, `tts-${Date.now()}.${sourceFormat}`);

  await writeFile(inputPath, audio);

  let playPath = inputPath;

  if (needsTranscode) {
    if (!(await isFfmpegAvailable())) {
      outputFormat = sourceFormat;
      speed = 1;
      needsTranscode = false;
      console.log("ffmpeg not available; falling back to default speed/format.");
    }
  }

  if (needsTranscode) {
    const outputPath = shouldSave
      ? join(audioDir, `tts-${Date.now()}.${outputFormat}`)
      : join(tmpdir(), `tts-${Date.now()}.${outputFormat}`);

    await transcodeAudio(inputPath, outputPath, speed);

    if (inputIsTemporary && inputPath !== outputPath) {
      await unlink(inputPath).catch(() => undefined);
    }

    playPath = outputPath;
  }

  try {
    await playWithAfplay(playPath);
  } finally {
    if (!shouldSave) {
      scheduleCleanup(playPath);
    }
  }
}

function parseSpeed(value?: string): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.max(0.25, Math.min(4.0, parsed));
}

async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailableCache !== null) {
    return ffmpegAvailableCache;
  }

  try {
    const result = await new Promise<boolean>((resolve) => {
      const child = spawn("ffmpeg", ["-version"], {
        stdio: "ignore",
        env: { ...process.env, PATH: ensureToolingInPath() },
      });
      child.on("close", (code) => resolve(code === 0));
      child.on("error", () => resolve(false));
    });
    ffmpegAvailableCache = result;
    return result;
  } catch {
    ffmpegAvailableCache = false;
    return false;
  }
}

async function transcodeAudio(inputPath: string, outputPath: string, speed: number): Promise<void> {
  const args = ["-y", "-i", inputPath];
  const speedFilter = buildAtempoFilter(speed);

  if (speedFilter) {
    args.push("-filter:a", speedFilter);
  }

  args.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, PATH: ensureToolingInPath() },
    });

    let errorOutput = "";
    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`ffmpeg process error: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const details = errorOutput.trim();
        reject(new Error(`ffmpeg exited with code ${code}${details ? `: ${details}` : ""}`));
      }
    });
  });
}

function buildAtempoFilter(speed: number): string | null {
  if (speed === 1) {
    return null;
  }

  const filters: number[] = [];
  let remaining = speed;

  while (remaining > 2.0) {
    filters.push(2.0);
    remaining /= 2.0;
  }

  while (remaining < 0.5) {
    filters.push(0.5);
    remaining /= 0.5;
  }

  if (Math.abs(remaining - 1) > 0.001) {
    filters.push(remaining);
  }

  return filters.length > 0 ? filters.map((value) => `atempo=${value.toFixed(3)}`).join(",") : null;
}

async function playWithAfplay(filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const afplay = spawn("afplay", ["-v", "1.0", filePath]);

    let errorOutput = "";
    afplay.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    afplay.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errorMessage = `afplay exited with code ${code}`;
        const detailedError = errorOutput ? `${errorMessage}: ${errorOutput}` : errorMessage;
        reject(new Error(detailedError));
      }
    });

    afplay.on("error", (err) => {
      reject(new Error(`afplay process error: ${err.message}`));
    });
  });
}

function scheduleCleanup(filePath: string): void {
  const cleanup = async (attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      try {
        await unlink(filePath);
        return;
      } catch {
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }
  };

  const timeoutId = setTimeout(() => {
    cleanup().finally(() => cleanupTimeouts.delete(timeoutId));
  }, 1000);
  cleanupTimeouts.add(timeoutId);
}
