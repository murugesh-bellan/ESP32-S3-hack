"""BLE transport (Nordic UART Service) for the IMU logger/listener scripts.

bleak is async; this wraps it in a background thread with its own event loop
so it can expose the same synchronous write()/readline() interface as the
serial and TCP transports. Incoming notifications are appended to a byte
buffer and readline() splits on '\\n' - a BLE notification can only carry a
small chunk of a sample line, so the firmware sends each line as several
notifications and this side just concatenates raw bytes, same idea as the
socket transport.
"""

import asyncio
import threading
import time

from bleak import BleakClient, BleakScanner

from transport import BLE_DEVICE_NAME, BLE_RX_UUID, BLE_TX_UUID


class BleTransport:
    def __init__(self, timeout: float = 10.0):
        self._buf = bytearray()
        self._buf_lock = threading.Lock()
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop.run_forever, daemon=True)
        self._thread.start()

        future = asyncio.run_coroutine_threadsafe(self._connect(timeout), self._loop)
        self._client = future.result(timeout=timeout + 5)

    async def _connect(self, timeout):
        print(f"Scanning for BLE device '{BLE_DEVICE_NAME}' ({timeout:.0f}s)...")
        device = await BleakScanner.find_device_by_name(BLE_DEVICE_NAME, timeout=timeout)
        if device is None:
            raise RuntimeError(
                f"No BLE device named '{BLE_DEVICE_NAME}' found. Is the board powered on "
                "and showing 'BLE: advertising' on screen?"
            )
        client = BleakClient(device)
        await client.connect(timeout=timeout)
        await client.start_notify(BLE_TX_UUID, self._on_notify)
        print(f"BLE connected to {device.address}.")
        return client

    def _on_notify(self, _handle, data: bytearray):
        with self._buf_lock:
            self._buf.extend(data)

    def write(self, data: bytes):
        future = asyncio.run_coroutine_threadsafe(
            self._client.write_gatt_char(BLE_RX_UUID, data, response=False), self._loop
        )
        future.result(timeout=5)

    def readline(self) -> bytes:
        deadline = time.time() + 1.0
        while time.time() < deadline:
            with self._buf_lock:
                idx = self._buf.find(b"\n")
                if idx >= 0:
                    line = bytes(self._buf[: idx + 1])
                    del self._buf[: idx + 1]
                    return line
            time.sleep(0.005)
        return b""

    def reset_input_buffer(self):
        with self._buf_lock:
            self._buf.clear()

    def close(self):
        future = asyncio.run_coroutine_threadsafe(self._client.disconnect(), self._loop)
        try:
            future.result(timeout=5)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=2)
