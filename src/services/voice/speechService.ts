/**
 * Robust Cross-Platform Speech Synthesis Service
 * Provides reliable Text-to-Speech support across Web and Capacitor Android WebView.
 *
 * Resolves critical Android WebView issues:
 * 1. Chromium Android V8 GC Bug: Retains an active reference to SpeechSynthesisUtterance so it isn't garbage collected mid-speech.
 * 2. IPC Race Condition: Resolves the race between cancel() and speak() in Android's TTS service bridge.
 * 3. Stuck Queue State: Calls speechSynthesis.resume() to unwedge paused/pending queues.
 * 4. Voice Loading: Asynchronously populates and refreshes voices via onvoiceschanged.
 * 5. AudioContext Priming: Unlocks audio playback for continuous turn-by-turn navigation.
 */

class SpeechService {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isWarmedUp = false;
  private voices: SpeechSynthesisVoice[] = [];
  private lastSpokenText = '';
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.voices = window.speechSynthesis.getVoices();
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            this.voices = window.speechSynthesis.getVoices();
          } catch (_) {}
        };
      }
    } catch (_) {}
  }

  /**
   * Warm up and prime the speech engine on user interaction / navigation start.
   * Ensures Android WebView AudioTrack is unlocked and voices are fetched.
   */
  public warmUp(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
      if (!this.voices || this.voices.length === 0) {
        this.voices = window.speechSynthesis.getVoices();
      }

      if (!this.isWarmedUp) {
        this.isWarmedUp = true;
        // Silent instant utterance to prime Android WebView's AudioContext
        const warmUpUtterance = new SpeechSynthesisUtterance(' ');
        warmUpUtterance.volume = 0.01;
        warmUpUtterance.rate = 2.0;
        window.speechSynthesis.speak(warmUpUtterance);
        setTimeout(() => {
          try {
            window.speechSynthesis.cancel();
          } catch (_) {}
        }, 150);
      }
    } catch (_) {}
  }

  /**
   * Speaks a navigation announcement with deduplication and GC protection.
   */
  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      force?: boolean;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const cleanText = text?.trim();
    if (!cleanText) return;

    // Prevent duplicate announcements unless forced
    if (!options?.force && this.lastSpokenText === cleanText) {
      return;
    }

    try {
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }

      // Resume any stuck queue before cancel
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();

      // In Android WebView, asynchronous cancel IPC needs a short yield (35ms)
      // to avoid immediately cancelling the newly queued speak() call.
      this.pendingTimer = setTimeout(() => {
        try {
          window.speechSynthesis.resume();

          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = options?.rate ?? 1.0;
          utterance.pitch = options?.pitch ?? 1.0;
          utterance.volume = 1.0;

          // Select matching voice if available
          if (!this.voices || this.voices.length === 0) {
            this.voices = window.speechSynthesis.getVoices();
          }

          if (this.voices && this.voices.length > 0) {
            const preferredVoice =
              this.voices.find(v => v.lang === 'en-IN') ||
              this.voices.find(v => v.lang.startsWith('en')) ||
              this.voices.find(v => v.default) ||
              this.voices[0];

            if (preferredVoice) {
              utterance.voice = preferredVoice;
            }
          }

          // Retain strong reference to prevent V8 Garbage Collection bug on Android
          this.activeUtterance = utterance;
          this.lastSpokenText = cleanText;

          utterance.onend = () => {
            if (this.activeUtterance === utterance) {
              this.activeUtterance = null;
            }
          };

          utterance.onerror = () => {
            if (this.activeUtterance === utterance) {
              this.activeUtterance = null;
            }
            // Visual navigation continues unaffected
          };

          window.speechSynthesis.speak(utterance);
          window.speechSynthesis.resume();
        } catch (innerErr) {
          console.warn('Speech synthesis speak failure:', innerErr);
        }
      }, 35);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }

  /**
   * Cancels any active or pending speech immediately (e.g. on Mute or navigation exit).
   */
  public cancel(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }
      this.activeUtterance = null;
      window.speechSynthesis.cancel();
    } catch (_) {}
  }

  public resetLastSpoken(): void {
    this.lastSpokenText = '';
  }
}

export const speechService = new SpeechService();
