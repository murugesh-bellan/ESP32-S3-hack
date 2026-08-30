#!/usr/bin/env python3
"""Turn raw imu_logger.py output into clean, per-swing training rows.

Problem #1 this solves: a recording run tags EVERY sample with one label for
the whole session, but most of that session is idle time between swings.
Feeding that straight to a classifier teaches it that "still" and
"forehand" look the same.

Problem #2 (found after wiring up live inference: real swings kept reading
as "still" despite a strong measured peak): the windowing here originally
centered each window ON the true peak (pre_ms before it, post_ms after) -
only possible after the fact, by looking both forward and backward through
an already-recorded session. The board can't do that live; it only knows a
swing started once accel crosses the threshold, and has to capture forward
from there. Training on peak-centered windows and then classifying
causally-captured windows meant the two were never quite the same shape of
data. This script's windowing now exactly mirrors the firmware's real-time
capture (device/src/main.cpp's processPlaySample): trigger on threshold
crossing, seed the window with the same amount of pre-roll history the
board's ring buffer holds, then capture forward for the same fixed
duration - so a training example and a live capture are built the same way.

This script:
  - splits the raw stream into sessions (a label change or a >2s time gap
    starts a new session)
  - for a swing label (anything but "still"), triggers on the same threshold
    the firmware uses and captures the same causal window, discarding the
    idle gaps between swings
  - for "still", chunks the whole session into fixed windows (it's valid
    negative-class data throughout)
  - extracts one feature row per window: peak magnitude + mean/std/min/max
    per accel and gyro axis

Usage:
  python3 segment_swings.py                       # data/swings.csv -> data/swings_segmented.csv
  python3 segment_swings.py --threshold 1.2        # more sensitive trigger
"""

import argparse
import csv
import math
import statistics
from pathlib import Path

RAW_FIELDS = ["label", "device_ms", "ax", "ay", "az", "gx", "gy", "gz", "recv_unix_time"]
AXES = ["ax", "ay", "az", "gx", "gy", "gz"]
STATS = ["mean", "std", "min", "max"]


def load_sessions(path, session_gap_ms=2000):
    """Group raw rows into sessions: a label change or a large time gap starts a new one."""
    sessions = []
    current = None
    prev_label = None
    prev_ms = None

    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            label = row["label"]
            ms = float(row["device_ms"])
            sample = {
                "ms": ms,
                **{axis: float(row[axis]) for axis in AXES},
            }
            new_session = (
                current is None
                or label != prev_label
                or (prev_ms is not None and ms - prev_ms > session_gap_ms)
            )
            if new_session:
                current = {"label": label, "samples": []}
                sessions.append(current)
            current["samples"].append(sample)
            prev_label = label
            prev_ms = ms

    return sessions


def dyn_mag(sample):
    """Dynamic acceleration magnitude with gravity's 1g removed."""
    return math.sqrt(sample["ax"] ** 2 + sample["ay"] ** 2 + sample["az"] ** 2) - 1.0


def causal_windows(samples, threshold_g, pre_roll_ms, window_ms, cooldown_ms):
    """Mirror the firmware's real-time capture exactly: scan forward, and the
    moment dynamic accel crosses threshold (and we're not still in a previous
    capture's cooldown), open a window starting pre_roll_ms before that
    trigger sample and running for window_ms total. No re-triggering while
    that window is being filled (matches the firmware's `capturing` lock),
    then cooldown_ms of quiet before the next trigger is allowed - same as
    device/src/main.cpp's SWING_THRESHOLD_G / CAPTURE_WINDOW_MS / COOLDOWN_MS.
    """
    windows = []
    last_window_end_ms = float("-inf")
    i, n = 0, len(samples)
    while i < n:
        s = samples[i]
        in_cooldown = (s["ms"] - last_window_end_ms) < cooldown_ms
        if not in_cooldown and dyn_mag(s) >= threshold_g:
            window_start_ms = s["ms"] - pre_roll_ms
            window_end_ms = window_start_ms + window_ms
            window = [x for x in samples if window_start_ms <= x["ms"] <= window_end_ms]
            if len(window) >= 5:
                windows.append(window)
            last_window_end_ms = window_end_ms
            while i < n and samples[i]["ms"] < window_end_ms:
                i += 1
            continue
        i += 1
    return windows


def fixed_windows(samples, window_ms, stride_ms):
    if not samples:
        return []
    start_time = samples[0]["ms"]
    end_time = samples[-1]["ms"]
    windows = []
    t = start_time
    while t + window_ms <= end_time:
        win = [s for s in samples if t <= s["ms"] < t + window_ms]
        if len(win) >= 5:
            windows.append(win)
        t += stride_ms
    return windows


def extract_features(window, label):
    row = {"label": label, "n_samples": len(window), "peak_mag_g": max(dyn_mag(s) for s in window)}
    for axis in AXES:
        values = [s[axis] for s in window]
        row[f"{axis}_mean"] = statistics.fmean(values)
        row[f"{axis}_std"] = statistics.pstdev(values) if len(values) > 1 else 0.0
        row[f"{axis}_min"] = min(values)
        row[f"{axis}_max"] = max(values)
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    here = Path(__file__).parent
    parser.add_argument("--in", dest="in_path", default=str(here / "data" / "swings.csv"))
    parser.add_argument("--out", dest="out_path", default=str(here / "data" / "swings_segmented.csv"))
    # Defaults match device/src/main.cpp exactly: SWING_THRESHOLD_G,
    # PRE_BUFFER_SIZE (64 samples @ ~224Hz gyro ODR = ~285ms), CAPTURE_WINDOW_MS,
    # COOLDOWN_MS. Change one place, change the other, or training and live
    # inference drift apart again.
    parser.add_argument("--threshold", type=float, default=1.5, help="dynamic accel (g) that triggers a capture")
    parser.add_argument("--pre-roll-ms", type=float, default=285, help="pre-trigger history included in the window")
    parser.add_argument("--window-ms", type=float, default=500, help="total window length from pre-roll start")
    parser.add_argument("--cooldown-ms", type=float, default=700, help="quiet time required before the next trigger")
    parser.add_argument("--still-window-ms", type=float, default=500)
    parser.add_argument("--still-stride-ms", type=float, default=500)
    args = parser.parse_args()

    sessions = load_sessions(args.in_path)
    print(f"Loaded {len(sessions)} recording session(s) from {args.in_path}")

    feature_rows = []
    kept_samples = 0
    total_samples = sum(len(s["samples"]) for s in sessions)

    for session in sessions:
        label, samples = session["label"], session["samples"]
        if label == "still":
            windows = fixed_windows(samples, args.still_window_ms, args.still_stride_ms)
        else:
            windows = causal_windows(samples, args.threshold, args.pre_roll_ms, args.window_ms, args.cooldown_ms)
            print(f"  session label={label:10s} {len(samples):5d} raw samples -> {len(windows)} swing(s) detected")

        for w in windows:
            feature_rows.append(extract_features(w, label))
            kept_samples += len(w)

    out_path = Path(args.out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["label", "n_samples", "peak_mag_g"] + [f"{a}_{s}" for a in AXES for s in STATS]
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(feature_rows)

    pct = 100 * kept_samples / total_samples if total_samples else 0
    print(f"\nWrote {len(feature_rows)} labeled windows to {out_path}")
    print(f"Kept {kept_samples}/{total_samples} raw samples ({pct:.1f}%) — the rest was idle time between swings, discarded.")

    by_label = {}
    for row in feature_rows:
        by_label[row["label"]] = by_label.get(row["label"], 0) + 1
    print("Per-label window counts:", by_label)


if __name__ == "__main__":
    main()
