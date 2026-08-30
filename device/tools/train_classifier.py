#!/usr/bin/env python3
"""Train a dependency-free softmax gesture classifier on swings_segmented.csv.

Same pattern as tryouts/ESP32-S3-Live-Sensor-Loop/tools/train_tiny_model.py:
plain-Python softmax + gradient descent, output baked into a C header for
direct on-device inference (mean/scale normalization, then a linear layer
per class, then softmax) - no TFLite runtime needed for 4 classes.

Two things this adds over that reference, both needed because real swing
data is small and imbalanced:
  - class-balanced gradient weighting, so the majority class doesn't just
    dominate the loss
  - a held-out per-class accuracy check + confusion matrix, so we can tell
    real learning from a lucky-on-the-majority-class model

"still" is deliberately NOT a trained class, even though swings.csv/
swings_segmented.csv still contain it. In live Play mode the classifier only
ever runs after SWING_THRESHOLD_G is already crossed (device/src/main.cpp) -
genuine stillness never reaches inference at all, the threshold gate already
handles that. Training "still" as a class meant comparing real swings
against data captured at rest, a condition the model never actually needs to
reject post-trigger - it just ate model capacity that should separate
forehand/backhand/serve from each other, and a middling real swing would
sometimes lose to it.

Usage:
  python3 train_classifier.py
  python3 train_classifier.py --epochs 400 --lr 0.05
"""

import argparse
import csv
import math
import random
from pathlib import Path

CLASSES = ("forehand", "backhand", "serve")
FEATURE_COLUMNS = (
    "peak_mag_g",
    "ax_mean", "ax_std", "ax_min", "ax_max",
    "ay_mean", "ay_std", "ay_min", "ay_max",
    "az_mean", "az_std", "az_min", "az_max",
    "gx_mean", "gx_std", "gx_min", "gx_max",
    "gy_mean", "gy_std", "gy_min", "gy_max",
    "gz_mean", "gz_std", "gz_min", "gz_max",
)


def load_dataset(path):
    rows = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if row["label"] not in CLASSES:
                continue
            features = tuple(float(row[col]) for col in FEATURE_COLUMNS)
            rows.append((features, CLASSES.index(row["label"])))
    return rows


def split_train_holdout(rows, holdout_fraction, seed):
    rng = random.Random(seed)
    by_class = {c: [] for c in range(len(CLASSES))}
    for row in rows:
        by_class[row[1]].append(row)

    train, holdout = [], []
    for cls, examples in by_class.items():
        rng.shuffle(examples)
        n_holdout = max(1, round(len(examples) * holdout_fraction)) if len(examples) > 1 else 0
        holdout.extend(examples[:n_holdout])
        train.extend(examples[n_holdout:])
    rng.shuffle(train)
    return train, holdout


def compute_normalization(rows):
    n = len(rows)
    means = [sum(r[0][f] for r in rows) / n for f in range(len(FEATURE_COLUMNS))]
    variances = [sum((r[0][f] - means[f]) ** 2 for r in rows) / n for f in range(len(FEATURE_COLUMNS))]
    scales = [max(math.sqrt(v), 1e-6) for v in variances]
    return means, scales


def normalize(features, means, scales):
    return tuple((x - m) / s for x, m, s in zip(features, means, scales))


def softmax(logits):
    maximum = max(logits)
    values = [math.exp(v - maximum) for v in logits]
    total = sum(values)
    return [v / total for v in values]


def train(train_rows, epochs, lr, l2):
    n_features = len(FEATURE_COLUMNS)
    n_classes = len(CLASSES)
    rng = random.Random(7)
    weights = [[rng.uniform(-0.01, 0.01) for _ in range(n_features)] for _ in range(n_classes)]
    bias = [0.0] * n_classes

    class_counts = [sum(1 for _, y in train_rows if y == c) for c in range(n_classes)]
    class_weight = [len(train_rows) / (n_classes * max(count, 1)) for count in class_counts]

    for _ in range(epochs):
        rng.shuffle(train_rows)
        for features, target in train_rows:
            logits = [bias[c] + sum(w * x for w, x in zip(weights[c], features)) for c in range(n_classes)]
            probs = softmax(logits)
            sample_weight = class_weight[target]
            for c in range(n_classes):
                error = (probs[c] - (c == target)) * sample_weight
                for f in range(n_features):
                    weights[c][f] -= lr * (error * features[f] + l2 * weights[c][f])
                bias[c] -= lr * error
    return weights, bias


def predict(features, weights, bias):
    logits = [bias[c] + sum(w * x for w, x in zip(weights[c], features)) for c in range(len(CLASSES))]
    probs = softmax(logits)
    predicted = max(range(len(CLASSES)), key=lambda c: probs[c])
    return predicted, probs[predicted]


def evaluate(rows, weights, bias, label):
    confusion = [[0] * len(CLASSES) for _ in CLASSES]
    correct = 0
    for features, target in rows:
        predicted, _ = predict(features, weights, bias)
        confusion[target][predicted] += 1
        correct += predicted == target
    accuracy = correct / len(rows) if rows else 0.0
    print(f"\n{label} accuracy: {accuracy:.1%} ({correct}/{len(rows)})")
    header = "actual\\pred".ljust(11) + "".join(c.rjust(10) for c in CLASSES)
    print(header)
    for i, actual in enumerate(CLASSES):
        print(actual.ljust(11) + "".join(str(confusion[i][j]).rjust(10) for j in range(len(CLASSES))))
    return accuracy


def write_header(path, means, scales, weights, bias):
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/train_classifier.py from tools/data/swings_segmented.csv.\n")
        f.write("// Classes (must match this order): " + ", ".join(CLASSES) + "\n")
        f.write("#pragma once\n\n")
        f.write(f"constexpr size_t GESTURE_FEATURE_COUNT = {len(FEATURE_COLUMNS)};\n")
        f.write(f"constexpr size_t GESTURE_CLASS_COUNT = {len(CLASSES)};\n")
        f.write("constexpr float GESTURE_MEANS[] = {" + ", ".join(f"{x:.8f}f" for x in means) + "};\n")
        f.write("constexpr float GESTURE_SCALES[] = {" + ", ".join(f"{x:.8f}f" for x in scales) + "};\n")
        f.write(f"constexpr float GESTURE_WEIGHTS[][{len(FEATURE_COLUMNS)}] = {{\n")
        for row in weights:
            f.write("  {" + ", ".join(f"{x:.8f}f" for x in row) + "},\n")
        f.write("};\n")
        f.write("constexpr float GESTURE_BIASES[] = {" + ", ".join(f"{x:.8f}f" for x in bias) + "};\n")


def main():
    here = Path(__file__).parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="in_path", default=str(here / "data" / "swings_segmented.csv"))
    parser.add_argument("--out", dest="out_path", default=str(here.parent / "include" / "gesture_model.h"))
    parser.add_argument("--epochs", type=int, default=300)
    parser.add_argument("--lr", type=float, default=0.05)
    parser.add_argument("--l2", type=float, default=0.001)
    parser.add_argument("--holdout-fraction", type=float, default=0.2)
    args = parser.parse_args()

    rows = load_dataset(args.in_path)
    print(f"Loaded {len(rows)} labeled windows from {args.in_path}")
    counts = {c: sum(1 for _, y in rows if y == i) for i, c in enumerate(CLASSES)}
    print("Per-class counts:", counts)

    train_rows, holdout_rows = split_train_holdout(rows, args.holdout_fraction, seed=42)
    print(f"Train: {len(train_rows)}  Holdout: {len(holdout_rows)}")

    means, scales = compute_normalization(train_rows)
    train_norm = [(normalize(f, means, scales), y) for f, y in train_rows]
    holdout_norm = [(normalize(f, means, scales), y) for f, y in holdout_rows]

    weights, bias = train(train_norm, args.epochs, args.lr, args.l2)

    evaluate(train_norm, weights, bias, "Train")
    evaluate(holdout_norm, weights, bias, "Holdout")

    write_header(args.out_path, means, scales, weights, bias)
    print(f"\nWrote model header to {args.out_path}")


if __name__ == "__main__":
    main()
