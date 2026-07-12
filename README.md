# 蓝牙调光台灯 Web App

这是升压型蓝牙调光台灯的手机端控制 App。它使用 Web Bluetooth 连接 CH582F BLE 设备，实现开关、亮度调节和延时关机。

## 运行环境

- 推荐：Android Chrome 或 Android Edge。
- 桌面调试：Windows/macOS Chrome 或 Edge，电脑需要有蓝牙。
- 不推荐：iPhone Safari、微信内置浏览器、普通 `file://` 打开。

Web Bluetooth 需要安全上下文：

- 桌面本机调试可用 `http://localhost:8765`。
- 手机真实演示建议把 `ble-lamp-app` 部署到 HTTPS，例如 GitHub Pages、Vercel、Netlify 或学校服务器 HTTPS。
- 手机访问电脑局域网 `http://电脑IP:8765` 通常不是安全上下文，浏览器会拒绝蓝牙 API。

## 操作步骤

1. 让 CH582F 广播设备名，前缀使用 `BT-Lamp`。
2. 在浏览器打开 App 页面。
3. 点击“连接台灯”。
4. 选择 `BT-Lamp...` 设备。
5. 连接后可操作：
   - 开关：发送 `P1` 或 `P0`
   - 亮度：发送 `B000` 到 `B100`
   - 延时关机：发送 `D000` 到 `D999`

## BLE UUID

| 项目 | UUID | 属性 |
|---|---|---|
| Lamp Service | `7b35f000-2d8d-4f9a-9f2f-6f61706d7031` | Primary Service |
| Control Characteristic | `7b35f001-2d8d-4f9a-9f2f-6f61706d7031` | Write / Write Without Response |
| Status Characteristic | `7b35f002-2d8d-4f9a-9f2f-6f61706d7031` | Notify，可选 |

## 命令格式

App 向 Control Characteristic 写入 UTF-8 ASCII 文本，每条命令以换行结尾。

| 命令 | 示例 | 含义 |
|---|---|---|
| `P0\n` / `P1\n` | `P1\n` | 关灯/开灯 |
| `Bxxx\n` | `B075\n` | 设置亮度百分比，000~100 |
| `Dxxx\n` | `D030\n` | 设置延时关机分钟数，000 表示取消 |

CH582F 可选通过 Status Characteristic Notify 返回：

```text
S,1,075,030\n
```

字段含义：电源状态、亮度、剩余延时分钟数。

## 与硬件调光的对应关系

硬件中 `VDIM` 越低，LED 电流越大。App 内部按以下关系显示 PWM 高电平占空比：

```text
VDIM = 3.3V - 2.4V × brightness / 100
PWM_high_duty = VDIM / 3.3V
```

因此：

- 100% 亮度：`VDIM≈0.9V`，PWM 高电平约 27%。
- 50% 亮度：`VDIM≈2.1V`，PWM 高电平约 64%。
- 0% 亮度：直接发送 `P0`，关闭 TLV61048 EN。

## 模拟模式

如果暂时没有 CH582F 硬件，点击“进入模拟模式”可以演示 UI 和通信命令记录。模拟模式不会连接蓝牙。
