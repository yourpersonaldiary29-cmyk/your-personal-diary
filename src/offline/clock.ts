/**
 * The device clock as the server sees it (section 4.4 "Time"): `editedAt` of an operation is
 * `Date.now() + offset`, where `offset` is learned from `serverNow` of every sync answer
 * (`serverNow - (sendTime + RTT / 2)`), smoothed, persisted in `meta` and capped at +-24 h.
 * A device whose clock runs slow would otherwise lose races it should win (section 3.5).
 */

export const MAX_OFFSET_MS = 24 * 60 * 60 * 1000;
/** Weight of a new sample in the smoothed offset. */
const SMOOTHING = 0.3;

function clamp(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(ms)));
}

export class DeviceClock {
  private offset: number;
  private samples = 0;

  constructor(initialOffsetMs = 0, private readonly now: () => number = () => Date.now()) {
    this.offset = clamp(initialOffsetMs);
    if (initialOffsetMs) this.samples = 1;
  }

  get offsetMs(): number {
    return this.offset;
  }

  /** Server time now, as an ISO string with milliseconds (the `editedAt` format). */
  editedAt(): string {
    return new Date(this.now() + this.offset).toISOString();
  }

  /** Server time now, in epoch ms. */
  serverNowMs(): number {
    return this.now() + this.offset;
  }

  /**
   * Learns from one answer: `serverNow` arrived for a request sent at `sentAt` and answered at
   * `receivedAt` (device epoch ms). Returns the new offset.
   */
  learn(serverNow: string, sentAt: number, receivedAt: number = this.now()): number {
    const server = Date.parse(serverNow);
    if (!Number.isFinite(server) || receivedAt < sentAt) return this.offset;
    const sample = clamp(server - (sentAt + (receivedAt - sentAt) / 2));
    this.offset = this.samples === 0 ? sample : clamp(this.offset + SMOOTHING * (sample - this.offset));
    this.samples++;
    return this.offset;
  }
}
