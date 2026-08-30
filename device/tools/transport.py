"""Shared transport for the IMU logger/listener scripts: a serial port
(/dev/cu.usbmodemXXXX), the board's WiFi TCP server (tcp:<ip>:<port>, shown
on the board's screen once it connects to WiFi), or BLE (target "ble",
device name "Tennis Hack IMU" - no network needed at all). All three expose
the same minimal interface the scripts use: write(), readline(),
reset_input_buffer(), close().
"""

import re
import socket

import serial

_TCP_RE = re.compile(r"^tcp:([^:]+):(\d+)$")

BLE_DEVICE_NAME = "Tennis Hack IMU"
BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
BLE_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  # write: Mac -> board
BLE_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  # notify: board -> Mac


def open_transport(target: str, baud: int):
    if target == "ble":
        from ble_transport import BleTransport

        return BleTransport()
    match = _TCP_RE.match(target)
    if match:
        host, port = match.group(1), int(match.group(2))
        return _SocketTransport(host, port)
    return serial.Serial(target, baud, timeout=1)


class _SocketTransport:
    def __init__(self, host, port):
        self._sock = socket.create_connection((host, port), timeout=5)
        self._sock.settimeout(1.0)
        self._buf = b""

    def write(self, data: bytes):
        self._sock.sendall(data)

    def readline(self) -> bytes:
        while b"\n" not in self._buf:
            try:
                chunk = self._sock.recv(4096)
            except socket.timeout:
                return b""
            if not chunk:
                return b""
            self._buf += chunk
        line, self._buf = self._buf.split(b"\n", 1)
        return line + b"\n"

    def reset_input_buffer(self):
        self._buf = b""

    def close(self):
        self._sock.close()
