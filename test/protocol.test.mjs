import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampBrightness,
  encodeBrightnessCommand,
  encodeDelayCommand,
  encodePowerCommand,
  parseStatusLine,
  brightnessToPwmHighDuty,
} from '../src/protocol.mjs';

describe('BLE lamp protocol', () => {
  it('encodes power commands as compact ASCII frames', () => {
    assert.equal(encodePowerCommand(true), 'P1\n');
    assert.equal(encodePowerCommand(false), 'P0\n');
  });

  it('clamps and pads brightness commands to 0-100', () => {
    assert.equal(clampBrightness(-5), 0);
    assert.equal(clampBrightness(42.7), 43);
    assert.equal(clampBrightness(180), 100);
    assert.equal(encodeBrightnessCommand(7), 'B007\n');
    assert.equal(encodeBrightnessCommand(100), 'B100\n');
  });

  it('encodes delay shutdown in whole minutes', () => {
    assert.equal(encodeDelayCommand(0), 'D000\n');
    assert.equal(encodeDelayCommand(15.2), 'D015\n');
    assert.equal(encodeDelayCommand(1200), 'D999\n');
  });

  it('parses firmware status notifications', () => {
    assert.deepEqual(parseStatusLine('S,1,075,030\n'), {
      power: true,
      brightness: 75,
      delayMinutes: 30,
    });
  });

  it('maps brightness to the inverted PWM duty required by VDIM', () => {
    assert.equal(brightnessToPwmHighDuty(0), 1);
    assert.equal(brightnessToPwmHighDuty(100).toFixed(3), '0.273');
    assert.equal(brightnessToPwmHighDuty(50).toFixed(3), '0.636');
  });
});
