#!/usr/bin/env python3
"""
Convert the pickle model to JSON format for use in the React app.

Usage:
    python convert_model.py

This will create public/models/model.json from models/model-20251029-100049.pkl
"""

import pickle
import json
import sys
from pathlib import Path


# Add paths to allow importing the model classes
sys.path.insert(0, "src")
sys.path.insert(0, "modelisation")


class CustomUnpickler(pickle.Unpickler):
    """Custom unpickler that can handle missing modules."""

    def find_class(self, module, name):
        """Override to handle missing modules gracefully."""
        # Try to import from modelisation first
        if "simulate_quotes" in module or module == "simulate_quotes":
            try:
                from simulate_quotes import QuoteModel

                if name == "QuoteModel":
                    return QuoteModel
            except ImportError:
                pass

        # Default behavior
        try:
            return super().find_class(module, name)
        except (ModuleNotFoundError, AttributeError) as e:
            print(f"Warning: Could not import {module}.{name}: {e}")
            # Return a dummy class
            return type(name, (), {})


def convert_model_to_json():
    """Convert pickle model to JSON format."""
    model_path = Path("models/model-20251029-100049.pkl")
    output_path = Path("public/models/model.json")

    if not model_path.exists():
        print(f"Error: Model file not found at {model_path}")
        return

    print(f"Loading model from {model_path}...")
    with open(model_path, "rb") as f:
        model = CustomUnpickler(f).load()

    print("Converting to JSON format...")

    # Convert transition tables
    transition_json = {}
    for key, counter in model.transition.items():
        # key is ((regime0, regime1), sign)
        # Convert to "regime0,regime1,sign"
        regime_key = f"{key[0][0]},{key[0][1]},{key[1]}"

        # Convert counter to dict with string keys
        bin_dict = {}
        for (dp_bin, spread_bin, size_bin), count in counter.items():
            bin_key = f"{dp_bin},{spread_bin},{size_bin}"
            bin_dict[bin_key] = count

        transition_json[regime_key] = bin_dict

    # Convert regime counters
    ticks_per_regime_json = {
        f"{k[0]},{k[1]}": v for k, v in model.ticks_per_regime.items()
    }

    seconds_per_regime_json = {
        f"{k[0]},{k[1]}": v for k, v in model.seconds_per_regime.items()
    }

    # Create final JSON structure
    json_model = {
        "transition": transition_json,
        "ticks_per_regime": ticks_per_regime_json,
        "seconds_per_regime": seconds_per_regime_json,
    }

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing JSON to {output_path}...")
    with open(output_path, "w") as f:
        json.dump(json_model, f, indent=2)

    print("✓ Conversion complete!")
    print(f"  - Transition states: {len(transition_json)}")
    print(f"  - Regime types: {len(ticks_per_regime_json)}")
    print(f"\nYou can now run: npm install && npm run dev")


if __name__ == "__main__":
    convert_model_to_json()
