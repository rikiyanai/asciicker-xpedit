from __future__ import annotations

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
