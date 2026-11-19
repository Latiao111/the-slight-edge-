import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCompoundingCurve,
  computePennyDoubledSeries,
  formatMultiplier,
} from './compoundingMath';

test('computeCompoundingCurve reproduces 1% daily compounding for 365 days accurately', () => {
  const summary = computeCompoundingCurve({
    dailyRatePercent: 1,
    days: 365,
    dailyEffortUnits: 10,
  });

  assert.ok(Math.abs(summary.positiveMultiplier - 37.7834) < 0.01);
  assert.ok(Math.abs(summary.negativeMultiplier - 0.0255) < 0.01);
  assert.equal(summary.cumulativeEffortUnits, 3650);
  assert.equal(summary.tippingPointDay, 70);
  assert.ok(summary.series.length >= 13);
  assert.equal(summary.series[0].day, 0);
  assert.equal(summary.series[summary.series.length - 1].day, 365);
});

test('computePennyDoubledSeries reproduces Day 31 penny doubling ($10,737,418.24)', () => {
  const series = computePennyDoubledSeries(31);
  assert.equal(series.length, 31);
  assert.equal(series[0].doubledDollars, 0.01);
  assert.equal(series[30].day, 31);
  assert.ok(Math.abs(series[30].doubledDollars - 10_737_418.24) < 0.01);
});

test('formatMultiplier formats small, medium, and large numbers cleanly', () => {
  assert.equal(formatMultiplier(1.456), '1.46×');
  assert.equal(formatMultiplier(37.78), '37.8×');
  assert.equal(formatMultiplier(1480.2), '1,480×');
});
