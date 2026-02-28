set shell := ["zsh", "-lc"]

base_url := "http://127.0.0.1:5071"
ui_runner := "node scripts/ui_tests/runner/cli.mjs"

install-testing-deps:
    npm --prefix scripts/ui_tests install

# Starts local Flask workbench server (foreground)
dev:
    PYTHONPATH=src python3 -m pipeline_v2.app

test-smoke:
    {{ui_runner}} test:smoke --base-url {{base_url}}

test-e2e feature="workbench-skin-dock" png="":
    {{ui_runner}} test:e2e --base-url {{base_url}} --feature {{feature}} {{ if png != "" { "--png " + png } else { "" } }}

test-workbench-required png="" headed="0":
    {{ui_runner}} test:e2e --base-url {{base_url}} --feature workbench-required-tests {{ if headed != "0" { "--headed" } else { "" } }} {{ if png != "" { "--png " + png } else { "" } }}

test-parallel png="":
    {{ui_runner}} test:parallel --base-url {{base_url}} {{ if png != "" { "--png " + png } else { "" } }}

test-debug feature="workbench-skin-dock" png="":
    {{ui_runner}} test:e2e --base-url {{base_url}} --feature {{feature}} --headed {{ if png != "" { "--png " + png } else { "" } }}

dev-and-test-smoke:
    echo "Run in two terminals for now: 'just dev' and 'just test-smoke'"

clean-test-artifacts:
    rm -rf artifacts/ui-tests output/playwright/workbench-png-to-skin-* output/playwright/skin-dock-debug-*

# Red-green-refactor watch loop for skin testing (headed, auto-runs on file save)
ralph png:
    ./scripts/ralph.sh {{png}}
