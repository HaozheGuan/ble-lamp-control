# CH582F BLE 固件对接说明

## 目标

CH582F 固件需要提供一个 BLE GATT 服务，让手机 App 可以：

- 开/关台灯。
- 设置亮度 0~100%。
- 设置一键延时关机时间。
- 可选：通知当前状态。

## 广播

广播设备名建议：

```text
BT-Lamp-01
```

App 当前按 `BT-Lamp` 前缀搜索设备。

## GATT 服务

| 项目 | UUID | 属性 |
|---|---|---|
| Lamp Service | `7b35f000-2d8d-4f9a-9f2f-6f61706d7031` | Primary Service |
| Control Characteristic | `7b35f001-2d8d-4f9a-9f2f-6f61706d7031` | Write / Write Without Response |
| Status Characteristic | `7b35f002-2d8d-4f9a-9f2f-6f61706d7031` | Notify，可选 |

如果 CH582F 示例工程里已有 BLE UART/透传服务，也可以改 App 的 UUID 常量去适配已有服务；但课程报告中建议使用上表自定义服务，逻辑更清楚。

## 命令解析

每条命令为 ASCII，长度很短，适合默认 BLE 20 字节包。

```text
P1\n    开灯
P0\n    关灯
B075\n  亮度设置为 75%
D030\n  30 分钟后关机
D000\n  取消延时关机
```

固件解析伪代码：

```c
void on_control_write(const char *cmd, uint16_t len) {
    if (len < 2) return;

    switch (cmd[0]) {
    case 'P':
        if (cmd[1] == '1') lamp_set_power(true);
        if (cmd[1] == '0') lamp_set_power(false);
        break;

    case 'B': {
        int brightness = parse_3_digits(&cmd[1]);
        brightness = clamp(brightness, 0, 100);
        if (brightness == 0) {
            lamp_set_power(false);
        } else {
            lamp_set_power(true);
            lamp_set_brightness(brightness);
        }
        break;
    }

    case 'D': {
        int minutes = parse_3_digits(&cmd[1]);
        lamp_set_delay_minutes(clamp(minutes, 0, 999));
        break;
    }
    }

    notify_status();
}
```

## PWM 输出

硬件反馈网络要求 `VDIM` 越低电流越大。若 CH582F 用 PWM + RC 低通生成 `VDIM`，建议：

```text
VDIM = 3.3V - 2.4V × brightness / 100
PWM_high_duty = VDIM / 3.3V
```

示例：

| 亮度 | PWM 高电平占空比 | 说明 |
|---:|---:|---|
| 0% | 不输出，EN=0 | 真正关灯 |
| 25% | 82% | 低亮 |
| 50% | 64% | 中亮 |
| 75% | 45% | 较亮 |
| 100% | 27% | 满亮，约 250mA |

PWM 频率建议不低于 20kHz，避免可闻噪声和可见闪烁。RC 低通按硬件设计使用 4.7kΩ + 1uF。

## 状态通知

若实现 Notify，格式：

```text
S,<power>,<brightness>,<delay>\n
```

示例：

```text
S,1,075,030\n
```

含义：

- `power`: `0` 关灯，`1` 开灯。
- `brightness`: 000~100。
- `delay`: 剩余延时关机分钟数，000 表示无延时。

## 验收演示建议

1. 手机打开 App。
2. 点击连接，选择 `BT-Lamp-01`。
3. 点击开关，灯应开/关。
4. 拖动亮度滑块，灯应连续变化。
5. 设置 1 分钟延时，等待自动关灯。
6. 报告截图保留：App 连接页面、命令记录、硬件亮灯照片、测试数据表。
