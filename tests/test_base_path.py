"""Tests for base-path support: config helper, Blueprint routing, HTML injection."""
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


# ---------------------------------------------------------------------------
# Phase 2: HTML asset injection and __WB_BASE_PATH
# ---------------------------------------------------------------------------


class TestHtmlInjectionRootHosted:
    """HTML output under default BASE_PATH="" preserves root-relative paths."""

    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_workbench_contains_base_path_var(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert 'window.__WB_BASE_PATH = ""' in html

    def test_workbench_contains_boot_nonce(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert "window.__WB_SERVER_BOOT_NONCE" in html

    def test_workbench_styles_root_relative(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert 'href="/styles.css?' in html

    def test_workbench_rexpaint_css_root_relative(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert 'href="/rexpaint-editor/styles.css?' in html

    def test_workbench_js_root_relative(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert 'src="/workbench.js?' in html

    def test_workbench_whole_sheet_init_root_relative(self, client):
        r = client.get("/workbench")
        html = r.data.decode()
        assert 'src="/whole-sheet-init.js?' in html

    def test_wizard_styles_root_relative(self, client):
        r = client.get("/wizard")
        html = r.data.decode()
        assert 'href="/styles.css?' in html

    def test_wizard_js_root_relative(self, client):
        r = client.get("/wizard")
        html = r.data.decode()
        assert 'src="/wizard.js?' in html

    def test_wizard_workbench_link_root_relative(self, client):
        r = client.get("/wizard")
        html = r.data.decode()
        assert 'href="/workbench"' in html


class TestHtmlInjectionPrefixed:
    """HTML output under BASE_PATH="/xpedit" has prefixed asset URLs."""

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
        monkeypatch.delenv("PIPELINE_BASE_PATH", raising=False)
        importlib.reload(cfg_mod)
        importlib.reload(app_mod)

    def test_workbench_base_path_var(self):
        r = self.client.get("/xpedit/workbench")
        html = r.data.decode()
        assert 'window.__WB_BASE_PATH = "/xpedit"' in html

    def test_workbench_styles_prefixed(self):
        r = self.client.get("/xpedit/workbench")
        html = r.data.decode()
        assert 'href="/xpedit/styles.css?' in html

    def test_workbench_rexpaint_css_prefixed(self):
        r = self.client.get("/xpedit/workbench")
        html = r.data.decode()
        assert 'href="/xpedit/rexpaint-editor/styles.css?' in html

    def test_workbench_js_prefixed(self):
        r = self.client.get("/xpedit/workbench")
        html = r.data.decode()
        assert 'src="/xpedit/workbench.js?' in html

    def test_workbench_whole_sheet_init_prefixed(self):
        r = self.client.get("/xpedit/workbench")
        html = r.data.decode()
        assert 'src="/xpedit/whole-sheet-init.js?' in html

    def test_wizard_styles_prefixed(self):
        r = self.client.get("/xpedit/wizard")
        html = r.data.decode()
        assert 'href="/xpedit/styles.css?' in html

    def test_wizard_js_prefixed(self):
        r = self.client.get("/xpedit/wizard")
        html = r.data.decode()
        assert 'src="/xpedit/wizard.js?' in html

    def test_wizard_workbench_link_prefixed(self):
        r = self.client.get("/xpedit/wizard")
        html = r.data.decode()
        assert 'href="/xpedit/workbench"' in html
