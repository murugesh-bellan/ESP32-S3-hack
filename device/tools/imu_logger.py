#!/usr/bin/env python3
"""Record labeled IMU swings from the ESP32-S3 into a training CSV.

Run once per shot type, physically swing the board that many times, then
Ctrl+C and rerun with the next label. Appends to the same CSV across runs so
the dataset accumulates: device/tools/data/swings.csv.

Works untethered too: pass "ble" to connect over Bluetooth (no network
needed, the board just needs to be powered on and advertising - requires
`pip install bleak`), or tcp:<ip>:3333 if it's connected to WiFi (shown on
screen).

Usage:
  python3 imu_logger.py /dev/cu.usbmodemXXXX forehand
  python3 imu_logger.py ble forehand
  python3 imu_logger.py tcp:192.168.1.42:3333 forehand
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
    parser.add_argument("label", help="shot label for this recording run, e.g. forehand")
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

    ser.write(f"LABEL {args.label}\n".encode())
    ser.write(b"STREAM ON\n")

    count = 0
    last_report = time.time()
    print(f"Recording label='{args.label}' into {out_path} — swing now. Ctrl+C to stop.")

    try:
        with out_path.open("a", newline="") as f:
            writer = csv.writer(f)
            if is_new_file:
                writer.writerow(FIELDS)
            while True:
                raw = ser.readline().decode(errors="replace").strip()
                if not raw:
                    continue
                if raw.startswith("OK ") or raw.startswith("ERROR") or not raw.startswith("S,"):
                    if not raw.startswith("S,"):
                        print(f"  device: {raw}")
                    continue
                parts = raw.split(",")
                if len(parts) != 9:
                    continue
                _, label, device_ms, ax, ay, az, gx, gy, gz = parts
                writer.writerow([label, device_ms, ax, ay, az, gx, gy, gz, f"{time.time():.3f}"])
                count += 1
                if time.time() - last_report >= 1.0:
                    print(f"  {count} samples recorded")
                    last_report = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        ser.write(b"STREAM OFF\n")
        ser.close()
        print(f"\nStopped. {count} samples appended for label='{args.label}'.")


if __name__ == "__main__":
    sys.exit(main())
