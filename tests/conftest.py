from __future__ import annotations

import importlib
import os
import shutil
from pathlib import Path

import pytest

from pipeline_v2.app import create_app


@pytest.fixture(autouse=True)
def clean_data_dir():
    data_dir = Path(__file__).resolve().parents[1] / "data"
    if data_dir.exists():
        shutil.rmtree(data_dir)
    yield


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(params=["", "/xpedit"], ids=["root-hosted", "prefixed"])
def hosted_client(request, monkeypatch, clean_data_dir):
    """Yields (flask_test_client, route_prefix) for both root and /xpedit hosting."""
    prefix = request.param
    if prefix:
        monkeypatch.setenv("PIPELINE_BASE_PATH", prefix)
    else:
        monkeypatch.delenv("PIPELINE_BASE_PATH", raising=False)
    import pipeline_v2.config as cfg_mod
    import pipeline_v2.app as app_mod
    importlib.reload(cfg_mod)
    importlib.reload(app_mod)
    a = app_mod.create_app()
    a.config["TESTING"] = True
    yield a.test_client(), prefix
    # Restore original config
    monkeypatch.delenv("PIPELINE_BASE_PATH", raising=False)
    importlib.reload(cfg_mod)
    importlib.reload(app_mod)
