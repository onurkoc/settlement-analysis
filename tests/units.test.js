// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    toMm, fromMm, percentToFraction, fractionToPercent, slopeToN, formatSlopeN, formatMm, formatE3,
} from '../app/core/units.js';

test('length and percent conversions', () => {
    assert.equal(toMm(0.0123), 12.3);
    assert.equal(fromMm(12.5), 0.0125);
    assert.equal(percentToFraction(1), 0.01);
    assert.equal(fractionToPercent(0.015), 1.5);
});

test('slope 1/n: 0 gives Infinity and "–", never a string in a number', () => {
    assert.equal(slopeToN(0.002), 500);
    assert.equal(slopeToN(-0.002), 500);
    assert.equal(slopeToN(0), Infinity);
    assert.equal(slopeToN(-0), Infinity);
    assert.equal(formatSlopeN(580.66), '1/581');
    assert.equal(formatSlopeN(580.66, 1), '1/580.7');
    assert.equal(formatSlopeN(Infinity), '–');
});

test('number formats', () => {
    assert.equal(formatMm(0.029840812793226198), '29.84');
    assert.equal(formatE3(0.00054344), '0.543');
    assert.equal(formatE3(0.00054344, 2), '0.54');
});
