import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { spawn } from "child_process";

export type PlaybackState = {
  pid: number;
  filePath: string;
  player: "afplay";
};

const audioDir = join(homedir(), ".cache", "raycast-tts");
const playbackStatePath = join(audioDir, "playback-state.json");

export async function startPlayback(filePath: string): Promise<"finished" | "stopped"> {
  await stopPlayback().catch(() => false);

  return await new Promise<"finished" | "stopped">((resolve, reject) => {
    const afplay = spawn("afplay", ["-v", "1.0", filePath]);
    const pid = afplay.pid;

    if (!pid) {
      afplay.kill("SIGTERM");
      reject(new Error("afplay did not return a process id"));
      return;
    }

    let errorOutput = "";
    let settled = false;
    let statePersisted = false;

    const stateWrite = writePlaybackState({ pid, filePath, player: "afplay" })
      .then(() => {
        statePersisted = true;
      })
      .catch(async (err) => {
        try {
          afplay.kill("SIGTERM");
        } catch {
          // If the player already exited, the close/error handler will resolve the real outcome.
        }
        throw err;
      });

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      void stateWrite
        .catch(() => undefined)
        .then(async () => {
          if (statePersisted) {
            await clearPlaybackState(pid);
          }
        })
        .finally(handler);
    };

    afplay.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    afplay.on("close", (code, signal) => {
      settle(() => {
        if (code === 0) {
          resolve("finished");
          return;
        }

        if (signal === "SIGTERM" || signal === "SIGKILL") {
          resolve("stopped");
          return;
        }

        const errorMessage = `afplay exited with code ${code}`;
        const detailedError = errorOutput ? `${errorMessage}: ${errorOutput}` : errorMessage;
        reject(new Error(detailedError));
      });
    });

    afplay.on("error", (err) => {
      settle(() => {
        reject(new Error(`afplay process error: ${err.message}`));
      });
    });

    void stateWrite.catch((err) => {
      settle(() => {
        reject(new Error(`Failed to persist playback state: ${err.message}`));
      });
    });
  });
}

export async function stopPlayback(): Promise<boolean> {
  const state = await readPlaybackState();
  if (!state) {
    return false;
  }

  if (!(await isTrackedPlaybackProcess(state))) {
    await clearPlaybackState(state.pid);
    return false;
  }

  await stopProcess(state.pid);
  await clearPlaybackState(state.pid);
  return true;
}

async function stopProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (!isUnavailableProcessError(error)) {
      throw error;
    }
    return;
  }

  if (await waitForExit(pid, 2000)) {
    return;
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (!isUnavailableProcessError(error)) {
      throw error;
    }
    return;
  }

  await waitForExit(pid, 1000);
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isProcessAlive(pid))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return !(await isProcessAlive(pid));
}

async function readPlaybackState(): Promise<PlaybackState | null> {
  try {
    const raw = await readFile(playbackStatePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PlaybackState>;

    if (typeof parsed.pid !== "number" || typeof parsed.filePath !== "string" || parsed.player !== "afplay") {
      await rm(playbackStatePath, { force: true });
      return null;
    }

    return parsed as PlaybackState;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

async function writePlaybackState(state: PlaybackState): Promise<void> {
  await mkdir(audioDir, { recursive: true });
  const tempPath = `${playbackStatePath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(state), "utf8");
  await rename(tempPath, playbackStatePath);
}

async function clearPlaybackState(expectedPid: number): Promise<void> {
  const state = await readPlaybackState();
  if (!state || state.pid !== expectedPid) {
    return;
  }
  await rm(playbackStatePath, { force: true });
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isUnavailableProcessError(error)) {
      return false;
    }
    throw error;
  }
}

async function isTrackedPlaybackProcess(state: PlaybackState): Promise<boolean> {
  if (!(await isProcessAlive(state.pid))) {
    return false;
  }

  const command = await readProcessCommand(state.pid);
  return command === state.player;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function readProcessCommand(pid: number): Promise<string | null> {
  const result = await new Promise<string | null>((resolve, reject) => {
    const child = spawn("ps", ["-p", String(pid), "-o", "comm="], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const command = output.trim().split("/").pop() || null;
      resolve(command);
    });
  });

  return result;
}

function isUnavailableProcessError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error.code === "ESRCH" || error.code === "EPERM"),
  );
}
