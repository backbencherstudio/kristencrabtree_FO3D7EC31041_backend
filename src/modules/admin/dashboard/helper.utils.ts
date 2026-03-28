export function getMonthRange(offset: 0 | -1) {
  const now = new Date();

  // target month
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offset;

  // start of month (UTC)
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  // end of month (UTC)
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}


export function getYearRange(offset: 0 | -1) {
  const now = new Date();

  const year = now.getUTCFullYear() + offset;

  // start of year (UTC)
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));

  // end of year (UTC)
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
  
export function getLastNDaysRange(days) {
  const now = new Date();

  // End = today, end of day (UTC)
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));

  // Start = N days ago, start of day (UTC)
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days + 1, // +1 to include today
    0, 0, 0, 0
  ));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function formatPercentageChange(
    previous: number,
    current: number,
    decimals = 2,
  ): string {
    // Avoid division by zero
    if (previous === 0) {
      return current > 0 ? '+100%' : '0%';
    }

    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? '+' : change < 0 ? '-' : '';

    return `${sign}${Math.abs(change).toFixed(decimals)}%`;
  }


  export function getMonthRangeByYear(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { start, end };
}

export function isPremiumUser(subscriptionValidUntil?: string | null): boolean {
  if (!subscriptionValidUntil) return false;

  const expiryMs = Number(subscriptionValidUntil) * 1000; // epoch → ms
  return expiryMs > Date.now();
}

