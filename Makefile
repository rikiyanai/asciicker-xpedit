.PHONY: run test

run:
	PYTHONPATH=src python3 -m pipeline_v2.app

test:
	PYTHONPATH=src python3 -m pytest

e2e:
	PYTHONPATH=src python3 -m pytest tests/e2e/test_browser_flow.py -q
