export class TransitionTimer {
  private remaining: number | null = null;
  private previous: number | null = null;
  suspend(): void { this.previous = null; }
  reset(): void { this.remaining = null; this.previous = null; }
  sample(now: number, completed: boolean, running: boolean, delay: number): boolean {
    if (!completed) { this.reset(); return false; }
    this.remaining ??= delay;
    if (running && this.previous !== null) this.remaining -= now - this.previous;
    this.previous = running ? now : null;
    if (this.remaining > 0) return false;
    this.reset();
    return true;
  }
}
