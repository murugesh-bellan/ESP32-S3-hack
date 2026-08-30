#!/usr/bin/env python3
"""Export labelled raw IMU windows in the Edge Impulse CSV Wizard format.

The source collector writes one long labelled stream.  Edge Impulse needs one
time-series item per swing, with the class assigned at import time.  This
script uses the same peak/window logic as segment_swings.py and writes files
under data/edge_impulse/<label>/.

Each output file contains only raw signal columns:
    timestamp,ax,ay,az,gx,gy,gz

Example:
    python3 export_edge_impulse.py
    python3 export_edge_impulse.py --window-ms 600 --out data/edge_impulse
"""

import argparse
import bisect
import csv
from pathlib import Path

from segment_swings import find_peaks, fixed_windows, load_sessions, window_around


AXES = ["ax", "ay", "az", "gx", "gy", "gz"]


def resample(samples: list[dict], interval_ms: float) -> list[dict]:
    """Linearly resample serial-timestamped readings onto a uniform timeline."""
    start_ms, end_ms = samples[0]["ms"], samples[-1]["ms"]
    source_times = [sample["ms"] for sample in samples]
    output = []
    timestamp = start_ms
    while timestamp <= end_ms:
        right = bisect.bisect_left(source_times, timestamp)
        if right == 0:
            output.append({"ms": timestamp, **{axis: samples[0][axis] for axis in AXES}})
        elif right == len(samples):
            output.append({"ms": timestamp, **{axis: samples[-1][axis] for axis in AXES}})
        else:
            before, after = samples[right - 1], samples[right]
            ratio = (timestamp - before["ms"]) / (after["ms"] - before["ms"])
            output.append({
                "ms": timestamp,
                **{axis: before[axis] + ratio * (after[axis] - before[axis]) for axis in AXES},
            })
        timestamp += interval_ms
    return output


def write_window(path: Path, samples: list[dict], interval_ms: float) -> None:
    """Write a uniformly sampled raw time-series item for the CSV Wizard."""
    samples = resample(samples, interval_ms)
    start_ms = samples[0]["ms"]
    with path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", *AXES])
        for sample in samples:
            writer.writerow([round(sample["ms"] - start_ms, 3), *(sample[axis] for axis in AXES)])


def main() -> None:
    here = Path(__file__).parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="in_path", default=str(here / "data" / "swings.csv"))
    parser.add_argument("--out", dest="out_path", default=str(here / "data" / "edge_impulse"))
    parser.add_argument("--threshold", type=float, default=1.5)
    parser.add_argument("--pre-ms", type=float, default=200)
    parser.add_argument("--post-ms", type=float, default=400)
    parser.add_argument("--min-gap-ms", type=float, default=300)
    parser.add_argument("--still-window-ms", type=float, default=600)
    parser.add_argument("--still-stride-ms", type=float, default=600)
    parser.add_argument("--interval-ms", type=float, default=5, help="uniform export interval (5 ms = 200 Hz)")
    args = parser.parse_args()

    out_path = Path(args.out_path)
    out_path.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}

    for session in load_sessions(args.in_path):
        label, samples = session["label"], session["samples"]
        if label == "still":
            windows = fixed_windows(samples, args.still_window_ms, args.still_stride_ms)
        else:
            windows = [
                window_around(samples, peak, args.pre_ms, args.post_ms)
                for peak in find_peaks(samples, args.threshold, args.min_gap_ms)
            ]

        label_dir = out_path / label
        label_dir.mkdir(exist_ok=True)
        for window in windows:
            if len(window) < 5:
                continue
            number = counts.get(label, 0) + 1
            counts[label] = number
            write_window(label_dir / f"{label}_{number:03d}.csv", window, args.interval_ms)

    print("Exported Edge Impulse items:")
    for label, count in sorted(counts.items()):
        print(f"  {label}: {count}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
