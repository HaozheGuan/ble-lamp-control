export const LAMP_SERVICE_UUID = '7b35f000-2d8d-4f9a-9f2f-6f61706d7031';
export const LAMP_CONTROL_UUID = '7b35f001-2d8d-4f9a-9f2f-6f61706d7031';
export const LAMP_STATUS_UUID = '7b35f002-2d8d-4f9a-9f2f-6f61706d7031';
export const DEVICE_NAME_PREFIX = 'BT-Lamp';

const encoder = new TextEncoder();

export function clampBrightness(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function clampDelayMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(999, Math.round(numeric)));
}

export function encodePowerCommand(power) {
  return `P${power ? 1 : 0}\n`;
}

export function encodeBrightnessCommand(brightness) {
  return `B${String(clampBrightness(brightness)).padStart(3, '0')}\n`;
}

export function encodeDelayCommand(minutes) {
  return `D${String(clampDelayMinutes(minutes)).padStart(3, '0')}\n`;
}

export function commandToBytes(command) {
  return encoder.encode(command);
}

export function parseStatusLine(line) {
  const normalized = String(line).trim();
  const match = /^S,([01]),(\d{1,3}),(\d{1,3})$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid status line: ${line}`);
  }
  return {
    power: match[1] === '1',
    brightness: clampBrightness(Number(match[2])),
    delayMinutes: clampDelayMinutes(Number(match[3])),
  };
}

export function brightnessToPwmHighDuty(brightness) {
  const level = clampBrightness(brightness);
  const vdim = 3.3 - (2.4 * level) / 100;
  return Number((vdim / 3.3).toFixed(6));
}
