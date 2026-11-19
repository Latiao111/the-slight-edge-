export interface CompoundingPoint {
  day: number;
  positive: number;
  negative: number;
  baseline: number;
}

export interface CompoundingSummary {
  dailyRatePercent: number;
  days: number;
  dailyEffortUnits: number;
  positiveMultiplier: number;
  negativeMultiplier: number;
  gapRatio: number;
  cumulativeEffortUnits: number;
  tippingPointDay: number;
  series: CompoundingPoint[];
}

export interface PennyDayPoint {
  day: number;
  doubledDollars: number;
  lumpSumDollars: number;
}

/**
 * Computes The Slight Edge daily compounding trajectories:
 * - Positive curve: (1 + r)^t
 * - Negative curve: (1 - r)^t
 * - Tipping point day: first day where positive growth crosses 2x baseline.
 */
export function computeCompoundingCurve(params: {
  dailyRatePercent: number;
  days: number;
  dailyEffortUnits?: number;
  sampleCount?: number;
}): CompoundingSummary {
  const ratePct = Math.max(0.1, Math.min(5, params.dailyRatePercent));
  const days = Math.max(7, Math.min(1095, Math.round(params.days)));
  const dailyEffortUnits = Math.max(1, Math.min(240, Math.round(params.dailyEffortUnits ?? 10)));
  const sampleCount = Math.max(12, Math.min(80, params.sampleCount ?? 40));

  const r = ratePct / 100;
  const positiveMultiplier = Math.pow(1 + r, days);
  const negativeMultiplier = Math.pow(1 - r, days);
  const gapRatio = negativeMultiplier > 0 ? positiveMultiplier / negativeMultiplier : Infinity;

  // First day positive multiplier reaches >= 2.0
  const exactDoubleDay = Math.ceil(Math.log(2) / Math.log(1 + r));
  const tippingPointDay = Math.min(days, Math.max(1, exactDoubleDay));

  const series: CompoundingPoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const day = Math.round((i / sampleCount) * days);
    series.push({
      day,
      positive: Math.pow(1 + r, day),
      negative: Math.pow(1 - r, day),
      baseline: 1,
    });
  }

  return {
    dailyRatePercent: ratePct,
    days,
    dailyEffortUnits,
    positiveMultiplier,
    negativeMultiplier,
    gapRatio,
    cumulativeEffortUnits: dailyEffortUnits * days,
    tippingPointDay,
    series,
  };
}

/**
 * Computes Jeff Olson's classic Chapter 3 "Penny Doubled for 31 Days vs $1,000,000" table.
 */
export function computePennyDoubledSeries(totalDays = 31): PennyDayPoint[] {
  const clamped = Math.max(1, Math.min(35, Math.round(totalDays)));
  const points: PennyDayPoint[] = [];
  for (let day = 1; day <= clamped; day++) {
    const doubledDollars = 0.01 * Math.pow(2, day - 1);
    points.push({
      day,
      doubledDollars,
      lumpSumDollars: 1_000_000,
    });
  }
  return points;
}

export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1000) return `${Math.round(value).toLocaleString()}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}
