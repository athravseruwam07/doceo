/**
 * AudioSyncPlayer - Manages audio playback with sync to animations
 */

export interface AudioSegment {
  url: string;
  audio: HTMLAudioElement;
  loaded: boolean;
  duration: number;
}

export class AudioSyncPlayer {
  private segments: Map<string, AudioSegment> = new Map();
  private currentSegmentId: string | null = null;
  private isPlaying: boolean = false;
  private playbackRate: number = 1;
  private onSegmentEnd: ((segmentId: string) => void) | null = null;

  constructor() {
    // Initialize with no segments
  }

  /**
   * Preload audio segment
   */
  async preloadSegment(eventId: string, audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!audioUrl) {
        resolve();
        return;
      }

      try {
        const audio = new Audio();
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";

        const onCanPlay = () => {
          const duration = audio.duration || 0;
          this.segments.set(eventId, {
            url: audioUrl,
            audio,
            loaded: true,
            duration,
          });
          cleanup();
          resolve();
        };

        const onError = (error: Event) => {
          console.error(`Failed to preload audio for ${eventId}:`, error);
          cleanup();
          resolve(); // Don't reject, allow playback to continue without audio
        };

        const cleanup = () => {
          audio.removeEventListener("canplay", onCanPlay);
          audio.removeEventListener("error", onError);
        };

        audio.addEventListener("canplay", onCanPlay, { once: true });
        audio.addEventListener("error", onError, { once: true });

        audio.src = audioUrl;
        audio.load();
      } catch (error) {
        console.error(`Error preloading audio for ${eventId}:`, error);
        resolve(); // Don't reject
      }
    });
  }

  /**
   * Play a segment
   */
  async playSegment(eventId: string, duration: number): Promise<void> {
    const segment = this.segments.get(eventId);
    if (!segment || !segment.loaded) {
      // No audio available, just wait for duration
      return new Promise((resolve) => {
        setTimeout(resolve, duration * 1000);
      });
    }

    this.currentSegmentId = eventId;
    this.isPlaying = true;

    return new Promise((resolve) => {
      const audio = segment.audio;
      audio.playbackRate = this.playbackRate;
      audio.volume = 1.0;

      // Reset audio to start
      audio.currentTime = 0;

      const onEnded = () => {
        cleanup();
        this.isPlaying = false;
        this.currentSegmentId = null;
        if (this.onSegmentEnd) {
          this.onSegmentEnd(eventId);
        }
        resolve();
      };

      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
      };

      audio.addEventListener("ended", onEnded, { once: true });

      // Start playback
      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
        cleanup();
        resolve();
      });

      // Fallback: resolve after max duration + buffer
      setTimeout(() => {
        if (this.currentSegmentId === eventId && this.isPlaying) {
          audio.pause();
          cleanup();
          this.isPlaying = false;
          this.currentSegmentId = null;
          resolve();
        }
      }, (duration + 0.5) * 1000);
    });
  }

  /**
   * Pause all audio
   */
  pause(): void {
    this.isPlaying = false;
    this.segments.forEach((segment) => {
      segment.audio.pause();
    });
  }

  /**
   * Resume current segment
   */
  resume(): void {
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment && segment.loaded) {
        this.isPlaying = true;
        segment.audio.play().catch((error) => {
          console.error("Error resuming audio:", error);
        });
      }
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, speed));
    this.segments.forEach((segment) => {
      segment.audio.playbackRate = this.playbackRate;
    });
  }

  /**
   * Get current time of active segment
   */
  getCurrentTime(): number {
    if (this.currentSegmentId) {
      const segment = this.segments.get(this.currentSegmentId);
      if (segment) {
        return segment.audio.currentTime;
      }
    }
    return 0;
  }

  /**
   * Set callback for segment end
   */
  onSegmentComplete(callback: (segmentId: string) => void): void {
    this.onSegmentEnd = callback;
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.pause();
    this.segments.forEach((segment) => {
      segment.audio.src = "";
      segment.audio = null as any;
    });
    this.segments.clear();
    this.onSegmentEnd = null;
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }
}
