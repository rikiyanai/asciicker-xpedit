#!/usr/bin/env bash
set -euo pipefail
PYTHONPATH=src python3 -m pytest tests/e2e/test_browser_flow.py -q
