/**
 * AudioSyncPlayer - Manages audio playback synced to animation events.
 *
 * Key design decisions:
 * - Preloaded segments are cached and never recreated
 * - Preload has a timeout so it can't hang forever
 * - play() handles autoplay policy by retrying on user interaction
 * - If preload fails, playSegment falls back to on-the-fly Audio creation
 * - All errors are gracefully handled (animation continues without audio)
 */

export interface AudioSegment {
  url: string;
  audio: HTMLAudioElement;
  loaded: boolean;
  duration: number;
}

export class AudioSyncPlayer {
  private segments: Map<string, AudioSegment> = new Map();
  private loadingSegments: Set<string> = new Set();
  private currentSegmentId: string | null = null;
  private isPlaying: boolean = false;
  private playbackRate: number = 1;
  private audioUnlocked: boolean = false;

  constructor() {
    // Try to unlock audio on any user interaction
    this.setupAutoplayUnlock();
  }

  /**
   * Browsers block audio.play() until user interacts with the page.
   * Listen for the first click/touch/keydown and play a silent buffer
   * to unlock the audio context.
   */
  private setupAutoplayUnlock(): void {
    if (typeof window === "undefined") return;

    const unlock = () => {
      if (this.audioUnlocked) return;

      // Try Web Audio API unlock first (more reliable)
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        ctx.resume().then(() => {
          this.audioUnlocked = true;
          console.log("[Audio] Web Audio context unlocked");
          cleanup();
        }).catch(() => {});
      } catch {
        // Fallback: play silent HTML audio
      }

      // Also try HTML Audio unlock
      const silent = new Audio();
      silent.src =
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqSAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqSAAAAAAAAAAAAAAAAAAAA";
      silent.volume = 0.01;
      silent
        .play()
        .then(() => {
          this.audioUnlocked = true;
          silent.pause();
          silent.src = "";
          console.log("[Audio] HTML Audio unlocked");
          cleanup();
        })
        .catch(() => {
          // Still locked, will retry on next interaction
        });
    };

    const cleanup = () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
  }

  /**
   * Preload an audio segment. Cached — calling twice with the same eventId
   * returns immediately if already loaded or loading.
   */
  async preloadSegment(eventId: string, audioUrl: string): Promise<void> {
    if (!audioUrl) return;

    // Already loaded — skip
    const existing = this.segments.get(eventId);
    if (existing && existing.loaded) return;

    // Already loading — skip
    if (this.loadingSegments.has(eventId)) return;
    this.loadingSegments.add(eventId);

    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        audio.preload = "auto";

        const onLoaded = () => {
          this.segments.set(eventId, {
            url: audioUrl,
            audio,
            loaded: true,
            duration: audio.duration || 0,
          });
          this.loadingSegments.delete(eventId);
          cleanup();
          console.log(`[Audio] Preloaded ${eventId} (${audio.duration?.toFixed(1)}s)`);
          resolve();
        };

        const onError = (e: Event) => {
          const mediaError = audio.error;
          console.warn(`[Audio] Failed to preload ${eventId}: code=${mediaError?.code} msg=${mediaError?.message}`, e);
          this.loadingSegments.delete(eventId);
          cleanup();
          resolve(); // Don't block — animation continues without audio
        };

        const cleanup = () => {
          audio.removeEventListener("canplaythrough", onLoaded);
          audio.removeEventListener("canplay", onLoaded);
          audio.removeEventListener("error", onError);
          clearTimeout(timeout);
        };

        // Timeout: don't let preload hang forever (8 seconds max)
        const timeout = setTimeout(() => {
          // If we got some data, consider it loaded enough
          if (audio.readyState >= 2) {
            onLoaded();
          } else {
            console.warn(`[Audio] Preload timeout for ${eventId} (readyState=${audio.readyState})`);
            this.loadingSegments.delete(eventId);
            cleanup();
            resolve();
          }
        }, 8000);

        audio.addEventListener("canplaythrough", onLoaded, { once: true });
        audio.addEventListener("canplay", onLoaded, { once: true });
        audio.addEventListener("error", onError, { once: true });

        audio.src = audioUrl;
        audio.load();
      } catch (err) {
        console.warn(`[Audio] Exception in preloadSegment for ${eventId}:`, err);
        this.loadingSegments.delete(eventId);
        resolve();
      }
    });
  }

  /**
   * Play a preloaded segment. If not preloaded, creates Audio on-the-fly.
   * Returns immediately — does NOT block for the full duration.
   * Optional onEnded callback fires when audio playback completes.
   */
  async playSegment(eventId: string, audioUrl?: string, onEnded?: () => void): Promise<void> {
    let segment = this.segments.get(eventId);

    // Fallback: if preload didn't work, create Audio on-the-fly
    if ((!segment || !segment.loaded) && audioUrl) {
      console.log(`[Audio] No preloaded segment for ${eventId}, creating on-the-fly`);
      const audio = new Audio(audioUrl);
      segment = { url: audioUrl, audio, loaded: true, duration: 0 };
      this.segments.set(eventId, segment);
    }

    if (!segment || !segment.loaded) {
      console.warn(`[Audio] No segment and no URL for ${eventId}, skipping`);
      onEnded?.();
      return;
    }

    // Stop any currently playing segment
    if (this.currentSegmentId && this.currentSegmentId !== eventId) {
      const prev = this.segments.get(this.currentSegmentId);
      if (prev) {
        prev.audio.pause();
      }
    }

    this.currentSegmentId = eventId;
    this.isPlaying = true;

    const audio = segment.audio;
    audio.playbackRate = this.playbackRate;
    audio.volume = 1.0;
    audio.currentTime = 0;

    // Wire up completion callback with robust fallback paths.
    let completed = false;
    let stallTimeout: ReturnType<typeof setTimeout> | null = null;
    const completeOnce = () => {
      if (completed) return;
      completed = true;
      audio.removeEventListener("ended", completeOnce);
      audio.removeEventListener("error", completeOnce);
      audio.removeEventListener("abort", completeOnce);
      audio.removeEventListener("stalled", handleStall);
      audio.removeEventListener("waiting", handleStall);
      if (stallTimeout) {
        clearTimeout(stallTimeout);
        stallTimeout = null;
      }
      onEnded?.();
    };
    const handleStall = () => {
      if (stallTimeout) clearTimeout(stallTimeout);
      // If media remains stalled for too long, release playback progression.
      stallTimeout = setTimeout(() => {
        console.warn(`[Audio] Stall timeout for ${eventId}, continuing playback timeline`);
        completeOnce();
      }, 2500);
    };
    if (onEnded) {
      audio.addEventListener("ended", completeOnce);
      audio.addEventListener("error", completeOnce);
      audio.addEventListener("abort", completeOnce);
      audio.addEventListener("stalled", handleStall);
      audio.addEventListener("waiting", handleStall);
    }

    try {
      await audio.play();
      console.log(`[Audio] Playing ${eventId}`);
    } catch (err) {
      // Autoplay blocked or other error — log but don't crash
      console.warn(`[Audio] play() blocked for ${eventId}:`, err);
      this.isPlaying = false;
      this.currentSegmentId = null;
      completeOnce();
    }
  }

  /**
   * Get the actual loaded duration of an audio segment.
   * Returns 0 if the segment hasn't been loaded yet.
   */
  getDuration(eventId: string): number {
    const segment = this.segments.get(eventId);
    if (segment && segment.loaded) {
      return segment.audio.duration || segment.duration || 0;
    }
    return 0;
  }

  /**
   * Pause current audio
   */
  pause(): void {
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment) {
        segment.audio.pause();
      }
    }
    this.isPlaying = false;
  }

  /**
   * Resume current segment from where it left off
   */
  resume(): void {
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment && segment.loaded) {
        this.isPlaying = true;
        segment.audio.play().catch(() => {
          // Silently handle if resume fails
        });
      }
    }
  }

  /**
   * Set playback speed for current and future segments
   */
  setSpeed(speed: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, speed));
    // Update currently playing audio immediately
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment) {
        segment.audio.playbackRate = this.playbackRate;
      }
    }
  }

  getCurrentTime(): number {
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment) return segment.audio.currentTime;
    }
    return 0;
  }

  onSegmentComplete(callback: (segmentId: string) => void): void {
    // Not used in current architecture — animation timing is separate
    void callback;
  }

  destroy(): void {
    this.pause();
    this.segments.forEach((segment) => {
      segment.audio.pause();
      segment.audio.src = "";
    });
    this.segments.clear();
    this.loadingSegments.clear();
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }
}
