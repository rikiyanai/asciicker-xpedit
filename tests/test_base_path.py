"""Tests for Phase 1 base-path support: config helper + Blueprint routing."""
from __future__ import annotations

import importlib
import os

import pytest

from pipeline_v2.config import normalize_base_path


class TestNormalizeBasePath:
    def test_empty(self):
        assert normalize_base_path("") == ""

    def test_whitespace_only(self):
        assert normalize_base_path("   ") == ""

    def test_slash_only(self):
        assert normalize_base_path("/") == ""

    def test_bare_name(self):
        assert normalize_base_path("xpedit") == "/xpedit"

    def test_leading_slash(self):
        assert normalize_base_path("/xpedit") == "/xpedit"

    def test_trailing_slash(self):
        assert normalize_base_path("/xpedit/") == "/xpedit"

    def test_both_slashes(self):
        assert normalize_base_path("/asciicker-XPEdit/") == "/asciicker-XPEdit"

    def test_whitespace_and_slashes(self):
        assert normalize_base_path("  /xpedit/  ") == "/xpedit"

    def test_multi_segment(self):
        assert normalize_base_path("/a/b/c") == "/a/b/c"


class TestRoutesRootHosted:
    """Routes under default BASE_PATH="" (root-hosted, current behavior)."""

    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_healthz(self, client):
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.data == b"ok"

    def test_root_redirects_to_workbench(self, client):
        r = client.get("/")
        assert r.status_code == 302
        assert r.headers["Location"].endswith("/workbench")

    def test_api_templates_reachable(self, client):
        r = client.get("/api/workbench/templates")
        assert r.status_code == 200


class TestRoutesPrefixed:
    """Routes under BASE_PATH="/xpedit" (subpath-hosted)."""

    @pytest.fixture(autouse=True)
    def _app_with_prefix(self, monkeypatch, clean_data_dir):
        monkeypatch.setenv("PIPELINE_BASE_PATH", "/xpedit")
        import pipeline_v2.config as cfg_mod
        import pipeline_v2.app as app_mod
        importlib.reload(cfg_mod)
        importlib.reload(app_mod)
        app = app_mod.create_app()
        app.config["TESTING"] = True
        self.client = app.test_client()
        yield
        # Restore original config
        monkeypatch.delenv("PIPELINE_BASE_PATH", raising=False)
        importlib.reload(cfg_mod)
        importlib.reload(app_mod)

    def test_prefixed_healthz(self):
        r = self.client.get("/xpedit/healthz")
        assert r.status_code == 200
        assert r.data == b"ok"

    def test_bare_healthz_404(self):
        r = self.client.get("/healthz")
        assert r.status_code == 404

    def test_prefixed_root_redirects(self):
        r = self.client.get("/xpedit/")
        assert r.status_code == 302
        assert r.headers["Location"].endswith("/xpedit/workbench")

    def test_bare_root_404(self):
        r = self.client.get("/")
        assert r.status_code == 404

    def test_prefixed_templates_reachable(self):
        r = self.client.get("/xpedit/api/workbench/templates")
        assert r.status_code == 200
