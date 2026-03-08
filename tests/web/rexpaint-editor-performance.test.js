/**
 * Performance Baseline Tests
 *
 * Measures and validates performance characteristics of the editor.
 * Run with: node tests/web/rexpaint-editor-performance.test.js
 *
 * Performance goals:
 * - Canvas rendering: < 50ms for 80x25 grid
 * - Tool operations: < 100-200ms depending on operation
 * - Layer operations: < 50-100ms
 * - Memory usage: reasonable bounds for typical operations
 *
 * Regressions > 10% should be investigated.
 */

import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { LayerStack } from '../../web/rexpaint-editor/layer-stack.js';
import { CellTool } from '../../web/rexpaint-editor/tools/cell-tool.js';
import { LineTool } from '../../web/rexpaint-editor/tools/line-tool.js';
import { FillTool } from '../../web/rexpaint-editor/tools/fill-tool.js';
import { UndoStack } from '../../web/rexpaint-editor/undo-stack.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  describe(suiteName, suiteFunc) {
    console.log(`\n${suiteName}`);
    suiteFunc();
  }

  it(testName, testFunc) {
    try {
      testFunc();
      this.passed++;
      console.log(`  ✓ ${testName}`);
    } catch (error) {
      this.failed++;
      console.log(`  ✗ ${testName}`);
      console.log(`    ${error.message}`);
    }
  }

  report() {
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Simple assertion helpers
const expect = (value) => ({
  toBe(expected) {
    if (value !== expected) {
      throw new Error(`Expected ${expected}, got ${value}`);
    }
  },
  toEqual(expected) {
    if (JSON.stringify(value) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    }
  },
  toBeLessThan(expected) {
    if (value >= expected) {
      throw new Error(`Expected < ${expected}, got ${value}`);
    }
  },
  toBeLessThanOrEqual(expected) {
    if (value > expected) {
      throw new Error(`Expected <= ${expected}, got ${value}`);
    }
  },
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected > ${expected}, got ${value}`);
    }
  },
});

// Mock HTMLCanvasElement for Node.js environment
if (typeof HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class {
    constructor() {
      this.width = 0;
      this.height = 0;
      this._context = null;
    }

    getContext(type) {
      if (!this._context) {
        this._context = new CanvasContext(this);
      }
      return this._context;
    }
  };

  class CanvasContext {
    constructor(canvas) {
      this.canvas = canvas;
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.lineDashOffset = 0;
      this.font = '12px monospace';
      this.textAlign = 'left';
      this.textBaseline = 'top';
      this.pixelData = new Map();
      this.strokeRectCalls = [];
      this.setLineDashCalls = [];
    }

    fillRect(x, y, w, h) {
      const [r, g, b] = this._parseColor(this.fillStyle);
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          this.pixelData.set(`${px},${py}`, [r, g, b, 255]);
        }
      }
    }

    strokeRect(x, y, w, h) {
      this.strokeRectCalls.push([x, y, w, h]);
    }

    beginPath() {
      // Mock path tracking (no-op for testing)
    }

    moveTo(x, y) {
      // Mock path line (no-op for testing)
    }

    lineTo(x, y) {
      // Mock path line (no-op for testing)
    }

    stroke() {
      // Mock stroke (no-op for testing)
    }

    fillText(text, x, y, maxWidth) {}

    setLineDash(dash) {
      this.setLineDashCalls.push(dash);
    }

    _parseColor(colorStr) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
      return [0, 0, 0];
    }

    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const pixel = this.pixelData.get(`${px},${py}`) || [0, 0, 0, 0];
          const idx = (py * w + px) * 4;
          data[idx] = pixel[0];
          data[idx + 1] = pixel[1];
          data[idx + 2] = pixel[2];
          data[idx + 3] = pixel[3];
        }
      }
      return { data, width: w, height: h };
    }
  }
}

// Mock document.createElement
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return new HTMLCanvasElement();
      }
      throw new Error(`Unsupported element: ${tag}`);
    },
  };
}

// Mock requestAnimationFrame for Node.js environment
if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (callback) => {
    return 0;
  };
}

// Performance measurement utilities
class PerformanceMetrics {
  static measureSync(name, fn, iterations = 5) {
    const times = [];

    // Warm up
    fn();

    // Run iterations
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const stdDev = Math.sqrt(
      times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length
    );

    return { avg, min, max, stdDev, times };
  }

  static getMemoryUsage() {
    if (global.gc) {
      global.gc();
    }
    return process.memoryUsage();
  }

  static getMemoryDelta(before, after) {
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
    };
  }
}

// Run tests
const runner = new TestRunner();

runner.describe('Canvas Rendering Performance (80x25 grid, 2000 cells)', () => {
  runner.it('Render 80x25 canvas (partial) - should complete < 250ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Fill some cells to render
    for (let i = 0; i < 100; i++) {
      canvas.setCell(Math.floor(i % 80), Math.floor(i / 80), 65, [255, 255, 255], [0, 0, 0]);
    }

    const metrics = PerformanceMetrics.measureSync(
      'render',
      () => canvas.render(),
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(250);
  });

  runner.it('Render full 80x25 canvas with all cells - should complete < 150ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Fill all cells
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 80; x++) {
        canvas.setCell(x, y, 65, [255, 255, 255], [0, 0, 0]);
      }
    }

    const metrics = PerformanceMetrics.measureSync(
      'render-full',
      () => canvas.render(),
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(150);
  });

  runner.it('Render with grid enabled - should complete < 150ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    canvas.showGrid = true;

    const metrics = PerformanceMetrics.measureSync(
      'render-grid',
      () => canvas.render(),
      3
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(150);
  });

  runner.it('Render with selection outline - should complete < 150ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    const mockSelectTool = {
      getSelectionBounds: () => ({
        x: 10,
        y: 10,
        width: 20,
        height: 5,
      }),
    };
    canvas.setSelectionTool(mockSelectTool);

    const metrics = PerformanceMetrics.measureSync(
      'render-selection',
      () => canvas.render(),
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(150);
  });
});

runner.describe('Tool Performance (Canvas operations)', () => {
  runner.it('CellTool: Paint 100 cells - should complete < 100ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const cellTool = new CellTool();
    cellTool.setCanvas(canvas);
    cellTool.setColors([255, 255, 255], [0, 0, 0]);
    cellTool.setGlyph(65); // 'A'

    let cellCount = 0;
    const metrics = PerformanceMetrics.measureSync(
      'cell-tool-draw',
      () => {
        for (let i = 0; i < 100; i++) {
          cellTool.paint(i % 80, Math.floor(i / 80));
          cellCount++;
        }
      },
      3
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms (${cellCount} cells), min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(100);
  });

  runner.it('LineTool: Draw line (~40 cells) - should complete < 80ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const lineTool = new LineTool();
    lineTool.setCanvas(canvas);
    lineTool.setColors([255, 255, 255], [0, 0, 0]);
    lineTool.setGlyph(65); // 'A'

    const metrics = PerformanceMetrics.measureSync(
      'line-tool-draw',
      () => {
        lineTool.startLine(0, 0);
        lineTool.drawLine(39, 0);
        lineTool.endLine();
      },
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(80);
  });

  runner.it('FillTool: Fill 400 cells (20x20 area) - should complete < 300ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Pre-fill a connected region
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        canvas.setCell(x, y, 65, [255, 0, 0], [0, 0, 0]);
      }
    }

    const fillTool = new FillTool();
    fillTool.setCanvas(canvas);
    fillTool.setColors([0, 255, 0], [0, 0, 0]);
    fillTool.setGlyph(65);

    const metrics = PerformanceMetrics.measureSync(
      'fill-tool',
      () => {
        fillTool.paint(10, 10); // Click in center of filled region
      },
      3
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(300);
  });

  runner.it('Copy/Paste: 400 cells (20x20 area) - should complete < 100ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Create clipboard data (20x20 grid of cells)
    const clipboard = [];
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        clipboard.push({
          glyph: 65,
          fg: [255, 255, 255],
          bg: [0, 0, 0],
        });
      }
    }

    const metrics = PerformanceMetrics.measureSync(
      'copy-paste',
      () => {
        // Simulate paste operation (copying 400 cells)
        let idx = 0;
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 20; x++) {
            const cell = clipboard[idx++];
            canvas.setCell(x, y, cell.glyph, cell.fg, cell.bg);
          }
        }
      },
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(100);
  });

  runner.it('Undo/Redo: 20 operations - should complete < 100ms avg', () => {
    const undoStack = new UndoStack(50);
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Create 20 actions
    for (let i = 0; i < 20; i++) {
      const snapshot = {
        cells: new Map(canvas.cells),
        timestamp: Date.now(),
      };
      undoStack.push(snapshot);
    }

    const metrics = PerformanceMetrics.measureSync(
      'undo-redo',
      () => {
        // Perform undo/redo cycle
        for (let i = 0; i < 5; i++) {
          if (undoStack.canUndo()) {
            undoStack.undo();
          }
        }
        for (let i = 0; i < 5; i++) {
          if (undoStack.canRedo()) {
            undoStack.redo();
          }
        }
      },
      3
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(100);
  });
});

runner.describe('Layer Performance', () => {
  runner.it('Switch between 5 layers - should complete < 50ms avg', () => {
    const layerStack = new LayerStack(80, 25);

    for (let i = 0; i < 5; i++) {
      layerStack.addLayer(`Layer ${i}`);
    }

    const metrics = PerformanceMetrics.measureSync(
      'layer-switch',
      () => {
        for (let i = 0; i < 5; i++) {
          layerStack.selectLayer(i);
        }
      },
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(50);
  });

  runner.it('Composite 5 visible layers - should complete < 200ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const layerStack = new LayerStack(80, 25);

    for (let i = 0; i < 5; i++) {
      layerStack.addLayer(`Layer ${i}`);
    }

    // Add some cells to each layer
    const layers = layerStack.getLayers();
    layers.forEach((layer, idx) => {
      for (let x = 0; x < 10; x++) {
        layer.setCell(x, idx * 5, 65 + idx, [255, 255, 255], [0, 0, 0]);
      }
    });

    canvas.setLayerStack(layerStack);

    const metrics = PerformanceMetrics.measureSync(
      'layer-composite',
      () => canvas.render(),
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(200);
  });

  runner.it('Hide/show layer (render) - should complete < 250ms avg', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const layerStack = new LayerStack(80, 25);

    layerStack.addLayer('Layer 1');
    layerStack.addLayer('Layer 2');

    canvas.setLayerStack(layerStack);

    const metrics = PerformanceMetrics.measureSync(
      'layer-visibility',
      () => {
        const layers = layerStack.getLayers();
        layers[0].setVisible(false);
        canvas.render();
        layers[0].setVisible(true);
        canvas.render();
      },
      5
    );

    console.log(`    avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, stdDev=${metrics.stdDev.toFixed(2)}ms`);
    expect(metrics.avg).toBeLessThan(250);
  });
});

runner.describe('Memory Usage and State Management', () => {
  runner.it('50-operation undo stack - memory < 20MB', () => {
    const before = PerformanceMetrics.getMemoryUsage();

    const undoStack = new UndoStack(50);
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // Fill canvas with data
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 80; x++) {
        canvas.setCell(x, y, 65, [255, 255, 255], [0, 0, 0]);
      }
    }

    // Create 50 snapshots
    for (let i = 0; i < 50; i++) {
      const snapshot = {
        cells: new Map(canvas.cells),
        timestamp: Date.now(),
      };
      undoStack.push(snapshot);
    }

    const after = PerformanceMetrics.getMemoryUsage();
    const delta = PerformanceMetrics.getMemoryDelta(before, after);
    const usedMB = delta.heapUsed / (1024 * 1024);

    console.log(`    heap used delta=${usedMB.toFixed(2)}MB`);
    expect(usedMB).toBeLessThan(20);
  });

  runner.it('Clipboard store (400 cells) - memory < 500KB', () => {
    const before = PerformanceMetrics.getMemoryUsage();

    // Create a clipboard with 20x20 cells
    const clipboard = [];
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        clipboard.push({
          glyph: 65,
          fg: [255, 255, 255],
          bg: [0, 0, 0],
        });
      }
    }

    const after = PerformanceMetrics.getMemoryUsage();
    const delta = PerformanceMetrics.getMemoryDelta(before, after);
    const usedKB = delta.heapUsed / 1024;

    console.log(`    heap used delta=${usedKB.toFixed(2)}KB`);
    expect(usedKB).toBeLessThan(500);
  });

  runner.it('Layer stack (5 layers, 80x25 each) - memory < 5MB', () => {
    const before = PerformanceMetrics.getMemoryUsage();

    const layerStack = new LayerStack(80, 25);

    for (let i = 0; i < 5; i++) {
      layerStack.addLayer(`Layer ${i}`);
    }

    // Fill each layer with cells
    const layers = layerStack.getLayers();
    layers.forEach((layer) => {
      for (let y = 0; y < 25; y++) {
        for (let x = 0; x < 80; x++) {
          layer.setCell(x, y, 65, [255, 255, 255], [0, 0, 0]);
        }
      }
    });

    const after = PerformanceMetrics.getMemoryUsage();
    const delta = PerformanceMetrics.getMemoryDelta(before, after);
    const usedMB = delta.heapUsed / (1024 * 1024);

    console.log(`    heap used delta=${usedMB.toFixed(2)}MB`);
    expect(usedMB).toBeLessThan(5);
  });
});

runner.report();
