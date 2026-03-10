#!/usr/bin/env node

/**
 * Week 1 XP File I/O Watchdog Testing Script
 *
 * Monitors W1.1-W1.5 implementations and validates all 70 tests pass.
 * Checks spec compliance, reports test coverage, and detects regressions.
 *
 * Usage:
 *   node scripts/watchdog-week1-testing.mjs
 *   node scripts/watchdog-week1-testing.mjs --verbose
 *   node scripts/watchdog-week1-testing.mjs --timeout 120
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Task definitions for Week 1
const TASKS = [
  {
    taskId: 'W1.1',
    name: 'XP File Reader - Core Structure & Gzip',
    file: 'tests/web/rexpaint-editor-xp-file-reader.test.js',
    expectedTests: 27
  },
  {
    taskId: 'W1.2',
    name: 'XP File Reader - Layer Decompression',
    file: 'tests/web/rexpaint-editor-xp-file-reader.test.js',
    expectedTests: 27
  },
  {
    taskId: 'W1.3',
    name: 'XP File Reader - EditorApp Integration',
    file: 'tests/web/rexpaint-editor-xp-integration.test.js',
    expectedTests: 10
  },
  {
    taskId: 'W1.4',
    name: 'XP File Writer - Core Structure & Compression',
    file: 'tests/web/rexpaint-editor-xp-file-writer.test.js',
    expectedTests: 25
  },
  {
    taskId: 'W1.5',
    name: 'XP File Writer - EditorApp Integration & Roundtrip',
    file: 'tests/web/rexpaint-editor-xp-integration.test.js',
    expectedTests: 10
  }
];

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const timeoutIndex = args.findIndex(arg => arg === '--timeout');
const timeoutSec = timeoutIndex !== -1 && args[timeoutIndex + 1]
  ? parseInt(args[timeoutIndex + 1])
  : 90;

class WatchdogTester {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.startTime = null;
    this.verbose = verbose;
  }

  runTest(task) {
    const testPath = resolve(projectRoot, task.file);
    const timeoutMs = timeoutSec * 1000;

    if (this.verbose) {
      console.log(`\n  📝 Running: ${testPath}`);
    }

    try {
      const output = execFileSync('node', [testPath], {
        cwd: projectRoot,
        timeout: timeoutMs,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const { passed, failed, total } = this.parseTestOutput(output);

      return {
        taskId: task.taskId,
        taskName: task.name,
        expectedTests: task.expectedTests,
        status: failed === 0 ? 'pass' : 'fail',
        exitCode: 0,
        output,
        passed,
        failed,
        total
      };
    } catch (error) {
      let passed = 0;
      let failed = 0;
      let total = 0;
      let status = 'error';

      // Check if it failed due to test failures
      if (error.stdout) {
        const result = this.parseTestOutput(error.stdout);
        passed = result.passed;
        failed = result.failed;
        total = result.total;
        status = failed > 0 ? 'fail' : 'error';
      }

      if (error.killed) {
        status = 'timeout';
      }

      return {
        taskId: task.taskId,
        taskName: task.name,
        expectedTests: task.expectedTests,
        status,
        exitCode: error.status || -1,
        output: error.stdout || '',
        stderr: error.stderr || error.message,
        passed,
        failed,
        total
      };
    }
  }

  parseTestOutput(output) {
    // Look for test summary line: "X passed, Y failed out of Z tests"
    const summaryMatch = output.match(/(\d+) passed, (\d+) failed out of (\d+) tests/);

    if (summaryMatch) {
      return {
        passed: parseInt(summaryMatch[1]),
        failed: parseInt(summaryMatch[2]),
        total: parseInt(summaryMatch[3])
      };
    }

    // Fallback: count test lines
    const passedCount = (output.match(/✓/g) || []).length;
    const failedCount = (output.match(/✗/g) || []).length;

    return {
      passed: passedCount,
      failed: failedCount,
      total: passedCount + failedCount
    };
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const millis = ms % 1000;
    return `${seconds}s ${millis}ms`;
  }

  printHeader() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        Week 1 XP File I/O Watchdog Testing Started        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`Expected total tests: 70 (W1.1-W1.5 combined)`);
    console.log(`Timeout per test: ${timeoutSec}s`);
    if (this.verbose) {
      console.log('Verbose mode: ON');
    }
    console.log('');
  }

  printTaskResult(result) {
    const statusIcon = result.status === 'pass' ? '✓' : '✗';
    const statusLabel = result.status.toUpperCase();

    console.log(`${statusIcon} ${result.taskId}: ${result.taskName}`);

    if (result.status === 'pass') {
      console.log(
        `  Tests: ${result.passed}/${result.total} passed (expected ${result.expectedTests})`
      );
      if (result.passed === result.expectedTests) {
        console.log('  Status: SPEC COMPLIANT');
      } else {
        console.log(
          `  ⚠️  Warning: Expected ${result.expectedTests} tests, got ${result.passed}`
        );
      }
    } else if (result.status === 'timeout') {
      console.log(`  Status: TIMEOUT after ${timeoutSec}s`);
      console.log('  ⚠️  Test did not complete in expected time');
    } else if (result.status === 'error') {
      console.log(`  Status: ERROR`);
      console.log(`  Error: ${result.stderr}`);
    } else {
      console.log(`  Status: ${statusLabel}`);
      console.log(`  Tests: ${result.passed}/${result.total} passed (expected ${result.expectedTests})`);
      if (result.failed > 0) {
        console.log(`  Failed: ${result.failed} test(s)`);
      }
    }

    if (this.verbose && (result.status !== 'pass' || result.failed > 0)) {
      console.log('\n  Output (last 20 lines):');
      const lines = result.output.split('\n').slice(-20);
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`    ${line}`);
        }
      });
      if (result.stderr) {
        console.log(`  Stderr: ${result.stderr.split('\n')[0]}`);
      }
    }

    console.log('');
  }

  printSummary() {
    const elapsed = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status !== 'pass').length;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                   Watchdog Summary Report                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Task summary
    console.log('TASK RESULTS:');
    this.results.forEach(result => {
      const statusIcon = result.status === 'pass' ? '✓' : '✗';
      const specMark =
        result.status === 'pass' && result.passed === result.expectedTests
          ? ' [SPEC OK]'
          : '';
      console.log(
        `  ${statusIcon} ${result.taskId}: ${result.status.toUpperCase()}${specMark}`
      );
    });

    // Test totals
    console.log(`\nTEST TOTALS:`);
    console.log(`  Passed: ${this.totalPassed}/70 tests`);
    console.log(`  Failed: ${70 - this.totalPassed} tests`);
    console.log(`  Coverage: ${Math.round((this.totalPassed / 70) * 100)}%`);

    // Spec compliance
    const specCompliant = this.results.every(
      r => r.status === 'pass' && r.passed === r.expectedTests
    );
    console.log(`\nSPEC COMPLIANCE:`);
    if (specCompliant) {
      console.log('  ✓ All tasks meet specification requirements');
    } else {
      console.log('  ✗ Some tasks have spec mismatches or failures');
      this.results.forEach(result => {
        if (result.status !== 'pass') {
          console.log(`    - ${result.taskId}: ${result.status}`);
        } else if (result.passed !== result.expectedTests) {
          console.log(
            `    - ${result.taskId}: Expected ${result.expectedTests}, got ${result.passed}`
          );
        }
      });
    }

    // Regression detection
    const hasRegressions = this.results.some(
      r =>
        r.failed > 0 ||
        r.status === 'timeout' ||
        r.status === 'error'
    );
    console.log(`\nREGRESSION DETECTION:`);
    if (hasRegressions) {
      console.log('  ⚠️  Regressions detected!');
      this.results.forEach(result => {
        if (result.failed > 0) {
          console.log(`    - ${result.taskId}: ${result.failed} failing test(s)`);
        }
        if (result.status === 'timeout') {
          console.log(`    - ${result.taskId}: Timeout (performance regression?)`);
        }
        if (result.status === 'error') {
          console.log(`    - ${result.taskId}: Runtime error`);
        }
      });
    } else {
      console.log('  ✓ No regressions detected');
    }

    // Overall verdict
    console.log(`\nOVERALL VERDICT:`);
    // All pass if: all 5 tasks pass, all tasks are spec compliant, no regressions
    const allPass =
      passed === TASKS.length &&
      specCompliant &&
      !hasRegressions;

    if (allPass) {
      console.log('  PASS - All Week 1 tests passing, spec compliant, no regressions');
    } else {
      console.log('  FAIL - Issues detected. See details above.');
    }

    console.log(`\nDuration: ${this.formatDuration(elapsed)}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    return allPass;
  }

  run() {
    this.startTime = Date.now();
    this.printHeader();

    // Run all tests sequentially
    for (const task of TASKS) {
      const result = this.runTest(task);
      this.results.push(result);
      this.totalTests += (result.total || 0);
      this.totalPassed += (result.passed || 0);
      this.printTaskResult(result);
    }

    // Print summary and return exit code
    const allPass = this.printSummary();
    process.exit(allPass ? 0 : 1);
  }
}

// Run the watchdog
const tester = new WatchdogTester();
tester.run();
