/** Per-client request budget, leaving room under Raindrop's 120 requests/minute OAuth limit. */
const REQUESTS_PER_MINUTE = 90

/**
 * Claim request slots and honor server backoff for the shared API client.
 * Instances are shared across polling, user mutations and exports; no request is retried implicitly.
 * @example
 * const budget = new RequestBudget()
 * const delay = budget.reserve(Date.now())
 */
export class RequestBudget {
  private starts: number[] = []
  private blockedUntil = 0

  /** Claim an immediate slot, or return a delay after which callers must check again. */
  reserve(now: number): number {
    this.starts = this.starts.filter((time) => time > now - 60_000)
    const capacityTime =
      this.starts.length >= REQUESTS_PER_MINUTE ? this.starts[0] + 60_000 : now
    const start = Math.max(now, capacityTime, this.blockedUntil)
    // Waiting work does not consume future slots; every wake-up rechecks newer server backoff.
    if (start === now) this.starts.push(now)
    return start - now
  }

  /** Delay future requests until the supplied server reset timestamp. */
  block(until: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, until)
  }
}
