import {
  DEVICE_NAME_PREFIX,
  LAMP_CONTROL_UUID,
  LAMP_SERVICE_UUID,
  LAMP_STATUS_UUID,
  brightnessToPwmHighDuty,
  clampBrightness,
  clampDelayMinutes,
  commandToBytes,
  encodeBrightnessCommand,
  encodeDelayCommand,
  encodePowerCommand,
  parseStatusLine,
} from './protocol.mjs';

const state = {
  bluetoothDevice: null,
  gattServer: null,
  controlCharacteristic: null,
  statusCharacteristic: null,
  connected: false,
  simulation: false,
  power: false,
  brightness: 50,
  delayMinutes: 0,
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  connect: $('#connectButton'),
  disconnect: $('#disconnectButton'),
  simulation: $('#simulationButton'),
  power: $('#powerSwitch'),
  brightness: $('#brightnessSlider'),
  brightnessValue: $('#brightnessValue'),
  delay: $('#delayMinutes'),
  delaySend: $('#delaySendButton'),
  statusDot: $('#statusDot'),
  statusText: $('#statusText'),
  deviceName: $('#deviceName'),
  duty: $('#pwmDuty'),
  commandLog: $('#commandLog'),
  supportMessage: $('#supportMessage'),
};

function log(message, tone = 'info') {
  const item = document.createElement('li');
  item.className = tone;
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  elements.commandLog.prepend(item);
}

function setConnected(connected, deviceName = '') {
  state.connected = connected;
  elements.statusDot.classList.toggle('online', connected || state.simulation);
  elements.statusText.textContent = state.simulation
    ? '模拟模式'
    : connected
      ? '已连接'
      : '未连接';
  elements.deviceName.textContent = deviceName || (state.simulation ? '本地模拟设备' : '未选择设备');
  elements.connect.disabled = connected || state.simulation;
  elements.disconnect.disabled = !connected && !state.simulation;
  setControlsEnabled(connected || state.simulation);
}

function setControlsEnabled(enabled) {
  elements.power.disabled = !enabled;
  elements.brightness.disabled = !enabled;
  elements.delay.disabled = !enabled;
  elements.delaySend.disabled = !enabled;
}

function renderState() {
  elements.power.checked = state.power;
  elements.brightness.value = state.brightness;
  elements.brightnessValue.textContent = `${state.brightness}%`;
  elements.delay.value = state.delayMinutes;
  elements.duty.textContent = `${Math.round(brightnessToPwmHighDuty(state.brightness) * 100)}%`;
  document.body.classList.toggle('lamp-on', state.power);
}

async function writeCommand(command) {
  if (state.simulation) {
    log(`模拟发送 ${command.trim()}`, 'ok');
    return;
  }
  if (!state.controlCharacteristic) {
    throw new Error('尚未连接控制特征值');
  }
  const bytes = commandToBytes(command);
  if (typeof state.controlCharacteristic.writeValueWithResponse === 'function') {
    await state.controlCharacteristic.writeValueWithResponse(bytes);
  } else {
    await state.controlCharacteristic.writeValue(bytes);
  }
  log(`发送 ${command.trim()}`, 'ok');
}

async function connectLamp() {
  if (!('bluetooth' in navigator)) {
    throw new Error('当前浏览器不支持 Web Bluetooth。请使用 Android Chrome/Edge，或桌面 Chrome/Edge。');
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
    optionalServices: [LAMP_SERVICE_UUID],
  });

  device.addEventListener('gattserverdisconnected', onDisconnected);
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(LAMP_SERVICE_UUID);
  const control = await service.getCharacteristic(LAMP_CONTROL_UUID);

  state.bluetoothDevice = device;
  state.gattServer = server;
  state.controlCharacteristic = control;

  try {
    const status = await service.getCharacteristic(LAMP_STATUS_UUID);
    state.statusCharacteristic = status;
    await status.startNotifications();
    status.addEventListener('characteristicvaluechanged', onStatusNotification);
  } catch {
    log('未找到状态通知特征值，仅使用写入控制', 'warn');
  }

  setConnected(true, device.name || DEVICE_NAME_PREFIX);
  await syncAll();
  log(`已连接 ${device.name || DEVICE_NAME_PREFIX}`, 'ok');
}

function onDisconnected() {
  state.bluetoothDevice = null;
  state.gattServer = null;
  state.controlCharacteristic = null;
  state.statusCharacteristic = null;
  setConnected(false);
  log('蓝牙连接已断开', 'warn');
}

function onStatusNotification(event) {
  const value = new TextDecoder().decode(event.target.value);
  try {
    const status = parseStatusLine(value);
    state.power = status.power;
    state.brightness = status.brightness;
    state.delayMinutes = status.delayMinutes;
    renderState();
    log(`状态 ${value.trim()}`, 'info');
  } catch (error) {
    log(error.message, 'warn');
  }
}

async function disconnectLamp() {
  if (state.simulation) {
    state.simulation = false;
    setConnected(false);
    log('已退出模拟模式', 'info');
    return;
  }
  if (state.bluetoothDevice?.gatt?.connected) {
    state.bluetoothDevice.gatt.disconnect();
  } else {
    onDisconnected();
  }
}

async function syncAll() {
  await writeCommand(encodePowerCommand(state.power));
  await writeCommand(encodeBrightnessCommand(state.brightness));
  await writeCommand(encodeDelayCommand(state.delayMinutes));
}

async function setPower(power) {
  state.power = Boolean(power);
  renderState();
  await writeCommand(encodePowerCommand(state.power));
}

async function setBrightness(brightness) {
  state.brightness = clampBrightness(brightness);
  renderState();
  if (state.brightness === 0) {
    state.power = false;
    renderState();
    await writeCommand(encodePowerCommand(false));
    return;
  }
  if (!state.power) {
    state.power = true;
    renderState();
    await writeCommand(encodePowerCommand(true));
  }
  await writeCommand(encodeBrightnessCommand(state.brightness));
}

async function setDelay(minutes) {
  state.delayMinutes = clampDelayMinutes(minutes);
  renderState();
  await writeCommand(encodeDelayCommand(state.delayMinutes));
}

function enterSimulation() {
  state.simulation = true;
  setConnected(true, '本地模拟设备');
  renderState();
  log('已进入模拟模式，可演示界面但不会连接硬件', 'warn');
}

function bindEvents() {
  elements.connect.addEventListener('click', async () => {
    try {
      await connectLamp();
    } catch (error) {
      log(error.message, 'warn');
    }
  });

  elements.disconnect.addEventListener('click', disconnectLamp);
  elements.simulation.addEventListener('click', enterSimulation);

  elements.power.addEventListener('change', async (event) => {
    try {
      await setPower(event.target.checked);
    } catch (error) {
      log(error.message, 'warn');
    }
  });

  elements.brightness.addEventListener('input', (event) => {
    state.brightness = clampBrightness(event.target.value);
    renderState();
  });

  elements.brightness.addEventListener('change', async (event) => {
    try {
      await setBrightness(event.target.value);
    } catch (error) {
      log(error.message, 'warn');
    }
  });

  elements.delaySend.addEventListener('click', async () => {
    try {
      await setDelay(elements.delay.value);
    } catch (error) {
      log(error.message, 'warn');
    }
  });
}

function init() {
  if (!('bluetooth' in navigator)) {
    elements.supportMessage.hidden = false;
  }
  setConnected(false);
  renderState();
  bindEvents();
}

init();
