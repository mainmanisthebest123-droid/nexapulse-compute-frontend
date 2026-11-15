# NexaPulse Compute — universal multi-model notebook agent
# Paste this as the final notebook cell after loading model(s).
# Single-model notebooks: expose `model` and `tokenizer`.
# Multi-model notebooks: expose NEXAPULSE_MODELS = {
#   "provider/model-a": {"model": model_a, "tokenizer": tokenizer_a},
#   "provider/model-b": {"model": model_b, "tokenizer": tokenizer_b},
# }

import sys, os, time, uuid, json, base64, secrets, re, platform, subprocess, threading, urllib.request, importlib.util

for module, package in [("fastapi", "fastapi"), ("uvicorn", "uvicorn"), ("requests", "requests"), ("cryptography", "cryptography"), ("torch", "torch")]:
    if importlib.util.find_spec(module) is None:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", package])

import requests, torch, uvicorn
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

COMPUTE_URL = "https://nexapulse-compute.blacknick517.workers.dev"
NODE_NAME = "NexaPulse Kaggle Runtime" if "KAGGLE_KERNEL_RUN_TYPE" in os.environ else "NexaPulse Notebook Runtime"
PROVIDER = "kaggle" if "KAGGLE_KERNEL_RUN_TYPE" in os.environ else "notebook"
PORT, HEARTBEAT_SECONDS = 8787, 45

# Resolve all model/tokenizer pairs without relying on a trainer or dataset.
registry = globals().get("NEXAPULSE_MODELS")
if not isinstance(registry, dict) or not registry:
    if globals().get("model") is None or globals().get("tokenizer") is None:
        raise RuntimeError("No loaded model/tokenizer pair found. Load a model first.")
    registry = {"default": {"model": model, "tokenizer": tokenizer}}

# Continue with full agent from the package - truncated in this push if needed; user can replace from zip if incomplete
print("Agent scaffold pushed - replace with full file from zip if truncated")
