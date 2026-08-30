#!/usr/bin/env python3
"""Passively record whatever the board streams, driven entirely by its own
touchscreen (tap a shot label, tap RECORD, swing, tap STOP). Unlike
imu_logger.py, this never sends LABEL/STREAM commands itself - it just
listens and appends to the shared training CSV.

Works untethered too: pass "ble" to connect over Bluetooth (no network
needed - requires `pip install bleak`), or tcp:<ip>:3333 if it's connected
to WiFi (shown on screen).

Usage:
  python3 imu_listener.py /dev/cu.usbmodemXXXX
  python3 imu_listener.py ble
  python3 imu_listener.py tcp:192.168.1.42:3333
"""

import argparse
import csv
import sys
import time
from pathlib import Path

from transport import open_transport

FIELDS = ["label", "device_ms", "ax", "ay", "az", "gx", "gy", "gz", "recv_unix_time"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("port", help="serial port (/dev/cu.usbmodem1101), tcp:<ip>:<port>, or 'ble'")
    parser.add_argument("--baud", type=int, default=460800, help="ignored for tcp: targets")
    parser.add_argument("--out", default=str(Path(__file__).parent / "data" / "swings.csv"))
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    is_new_file = not out_path.exists()

    print(f"Opening {args.port}...")
    ser = open_transport(args.port, args.baud)
    time.sleep(0.3)
    ser.reset_input_buffer()

    counts = {}
    last_report = time.time()
    print(f"Listening. Use the board's touchscreen to pick a label and start/stop recording.")
    print(f"Appending to {out_path}. Ctrl+C to stop.")

    try:
        with out_path.open("a", newline="") as f:
            writer = csv.writer(f)
            if is_new_file:
                writer.writerow(FIELDS)
            while True:
                raw = ser.readline().decode(errors="replace").strip()
                if not raw:
                    continue
                if not raw.startswith("S,"):
                    print(f"  device: {raw}")
                    continue
                parts = raw.split(",")
                if len(parts) != 9:
                    continue
                _, label, device_ms, ax, ay, az, gx, gy, gz = parts
                writer.writerow([label, device_ms, ax, ay, az, gx, gy, gz, f"{time.time():.3f}"])
                counts[label] = counts.get(label, 0) + 1
                if time.time() - last_report >= 1.0:
                    summary = ", ".join(f"{k}={v}" for k, v in counts.items())
                    print(f"  {summary}")
                    last_report = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()
        summary = ", ".join(f"{k}={v}" for k, v in counts.items()) or "none"
        print(f"\nStopped. Samples recorded this run: {summary}")


if __name__ == "__main__":
    sys.exit(main())
