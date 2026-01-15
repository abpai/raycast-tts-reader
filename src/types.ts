export interface Preferences {
  mode: "serve" | "generate";
  serverUrl?: string;
  voice: string;
  speed?: string;
  outputFormat: "wav" | "mp3" | "m4a" | "flac";
  saveAudioFiles?: boolean;
  variant?: string;
  lsdDecodeSteps?: string;
  temperature?: string;
  noiseClamp?: string;
  eosThreshold?: string;
  framesAfterEos?: string;
  device?: string;
}
