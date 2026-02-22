.PHONY: run test

run:
	PYTHONPATH=src python3 -m pipeline_v2.app

test:
	PYTHONPATH=src python3 -m pytest
