'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getSpeechCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Web Speech API hook. Calls onAppend with each finalized chunk; the caller
 * is responsible for appending it to whatever buffer they're displaying.
 *
 * Browser support: Chrome / Safari / Edge yes, Firefox limited. The hook
 * exposes `supported` so the caller can hide the mic button when missing.
 */
export function useSpeechRecognition({
  onAppend,
  onError,
}: {
  onAppend: (chunk: string) => void;
  onError?: (err: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechCtor());
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let chunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r && r.isFinal) chunk += r[0].transcript;
      }
      if (chunk) onAppend(chunk.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      onError?.(`Dictation error: ${e.error ?? 'unknown'}`);
    };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onAppend, onError]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  return { supported, listening, start, stop };
}
