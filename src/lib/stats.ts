export interface DataPoint {
  date: string;
  value: number;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function zscore(value: number, values: number[]): number {
  const m = mean(values);
  const s = stddev(values);
  if (s === 0) return 0;
  return (value - m) / s;
}

// Rolling correlation between two aligned time series (same dates assumed)
export function rollingCorrelation(
  a: number[],
  b: number[],
  window: number
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < a.length; i++) {
    if (i < window - 1) {
      result.push(null);
      continue;
    }
    const sliceA = a.slice(i - window + 1, i + 1);
    const sliceB = b.slice(i - window + 1, i + 1);
    result.push(pearson(sliceA, sliceB));
  }
  return result;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

// Align two series by date — returns matched pairs
export function alignByDate(
  seriesA: DataPoint[],
  seriesB: DataPoint[]
): { date: string; a: number; b: number }[] {
  const mapB = new Map(seriesB.map((p) => [p.date, p.value]));
  return seriesA
    .filter((p) => mapB.has(p.date))
    .map((p) => ({ date: p.date, a: p.value, b: mapB.get(p.date)! }));
}

// Align three series by date
export function alignThree(
  a: DataPoint[],
  b: DataPoint[],
  c: DataPoint[]
): { date: string; a: number; b: number; c: number }[] {
  const mapB = new Map(b.map((p) => [p.date, p.value]));
  const mapC = new Map(c.map((p) => [p.date, p.value]));
  return a
    .filter((p) => mapB.has(p.date) && mapC.has(p.date))
    .map((p) => ({ date: p.date, a: p.value, b: mapB.get(p.date)!, c: mapC.get(p.date)! }));
}
