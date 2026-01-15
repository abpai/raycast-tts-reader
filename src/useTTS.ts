import { getPreferenceValues } from "@raycast/api";
import { useMemo, useState } from "react";
import { createSpeech, getConfigError } from "./tts-utils";
import { Preferences } from "./types";

export function useTTS() {
  const preferences = getPreferenceValues<Preferences>();
  const [isLoading, setIsLoading] = useState(false);

  const error = useMemo(() => {
    const message = getConfigError(preferences);
    return message ? new Error(message) : undefined;
  }, [preferences.mode, preferences.serverUrl]);

  const speak = async (text: string) => {
    setIsLoading(true);
    try {
      return await createSpeech(text);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isReady: !error,
    speak,
    isLoading,
    error,
  };
}
