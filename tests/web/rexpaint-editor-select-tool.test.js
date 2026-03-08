/**
 * Selection Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-select-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-select-tool.test.js
 */

import { SelectTool } from '../../web/rexpaint-editor/tools/select-tool.js';

// Simple test framework (polyfill for vitest-like API)
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
  toBeNull() {
    if (value !== null) {
      throw new Error(`Expected null, got ${value}`);
    }
  },
  toBeTruthy() {
    if (!value) {
      throw new Error(`Expected truthy value, got ${value}`);
    }
  },
  toBeFalsy() {
    if (value) {
      throw new Error(`Expected falsy value, got ${value}`);
    }
  },
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected ${value} to be > ${expected}`);
    }
  },
  toBeGreaterThanOrEqual(expected) {
    if (value < expected) {
      throw new Error(`Expected ${value} to be >= ${expected}`);
    }
  },
});

// Run tests
const runner = new TestRunner();

runner.describe('Selection Tool', () => {
  // Test 1: Create SelectTool instance
  runner.it('should create SelectTool instance', () => {
    const tool = new SelectTool();
    expect(tool).toBeTruthy();
    expect(tool.startX).toBeNull();
    expect(tool.startY).toBeNull();
    expect(tool.endX).toBeNull();
    expect(tool.endY).toBeNull();
  });

  // Test 2: Start selection at coordinate
  runner.it('should start selection at coordinate', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(5, 3);

    expect(tool.startX).toBe(5);
    expect(tool.startY).toBe(3);
    expect(tool.endX).toBe(5);
    expect(tool.endY).toBe(3);
  });

  // Test 3: Drag to create selection rectangle
  runner.it('should drag to create selection rectangle', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(2, 2);
    tool.updateSelection(5, 5);

    expect(tool.startX).toBe(2);
    expect(tool.startY).toBe(2);
    expect(tool.endX).toBe(5);
    expect(tool.endY).toBe(5);
  });

  // Test 4: Get selected bounds (x, y, width, height)
  runner.it('should get selected bounds', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(2, 3);
    tool.updateSelection(5, 7);
    const bounds = tool.getSelectionBounds();

    expect(bounds).toBeTruthy();
    expect(bounds.x).toBe(2);
    expect(bounds.y).toBe(3);
    expect(bounds.width).toBe(4); // 5 - 2 + 1
    expect(bounds.height).toBe(5); // 7 - 3 + 1
  });

  // Test 5: Get selected cells within bounds - comprehensive verification
  runner.it('should get selected cells within bounds with exact coordinates', () => {
    const tool = new SelectTool();
    const canvas = {
      width: 80,
      height: 24,
      getCell: (x, y) => ({ glyph: 65 + x + y, fg: [255, 255, 255], bg: [0, 0, 0] }),
    };
    tool.setCanvas(canvas);

    tool.startSelection(0, 0);
    tool.updateSelection(2, 1);
    const cells = tool.getSelectedCells();

    // 3x2 selection should return 6 cells
    expect(cells.length).toBe(6);

    // Verify all expected coordinates are present
    const cellCoords = cells.map((c) => `${c.x},${c.y}`);
    const expectedCoords = ['0,0', '1,0', '2,0', '0,1', '1,1', '2,1'];
    for (const coord of expectedCoords) {
      expect(cellCoords.includes(coord)).toBeTruthy(`Expected ${coord} in selection`);
    }

    // Verify each cell has correct glyph data
    for (const cell of cells) {
      expect(cell.glyph).toBe(65 + cell.x + cell.y);
      expect(cell.fg).toEqual([255, 255, 255]);
      expect(cell.bg).toEqual([0, 0, 0]);
    }
  });

  // Test 6: Clear selection
  runner.it('should clear selection', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(5, 5);
    tool.updateSelection(10, 10);
    tool.clearSelection();

    expect(tool.startX).toBeNull();
    expect(tool.startY).toBeNull();
    expect(tool.endX).toBeNull();
    expect(tool.endY).toBeNull();
  });

  // Test 7: Selection respects canvas bounds
  runner.it('should handle selection with swapped coordinates', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    // Start at bottom-right, drag to top-left (swapped)
    tool.startSelection(10, 10);
    tool.updateSelection(5, 5);
    const bounds = tool.getSelectionBounds();

    expect(bounds.x).toBe(5); // Should normalize to top-left
    expect(bounds.y).toBe(5);
    expect(bounds.width).toBe(6); // 10 - 5 + 1
    expect(bounds.height).toBe(6);
  });

  // Test 8: Query if cell is selected - comprehensive boundary check
  runner.it('should query if cell is selected with complete boundary verification', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(2, 2);
    tool.updateSelection(5, 5);

    // Verify all cells within bounds return true
    for (let x = 2; x <= 5; x++) {
      for (let y = 2; y <= 5; y++) {
        expect(tool.isSelected(x, y)).toBeTruthy(`Cell (${x},${y}) should be selected`);
      }
    }

    // Verify cells just outside bounds return false
    expect(tool.isSelected(1, 2)).toBeFalsy(); // Left edge
    expect(tool.isSelected(1, 3)).toBeFalsy(); // Left middle
    expect(tool.isSelected(1, 5)).toBeFalsy(); // Left bottom
    expect(tool.isSelected(6, 2)).toBeFalsy(); // Right edge
    expect(tool.isSelected(6, 3)).toBeFalsy(); // Right middle
    expect(tool.isSelected(6, 5)).toBeFalsy(); // Right bottom
    expect(tool.isSelected(2, 1)).toBeFalsy(); // Top edge
    expect(tool.isSelected(3, 1)).toBeFalsy(); // Top middle
    expect(tool.isSelected(5, 1)).toBeFalsy(); // Top right
    expect(tool.isSelected(2, 6)).toBeFalsy(); // Bottom edge
    expect(tool.isSelected(3, 6)).toBeFalsy(); // Bottom middle
    expect(tool.isSelected(5, 6)).toBeFalsy(); // Bottom right
  });

  // Test 9: Return null bounds when no selection
  runner.it('should return null bounds when no selection', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    const bounds = tool.getSelectionBounds();
    expect(bounds).toBeNull();
  });

  // Test 10: Deactivate clears selection
  runner.it('should clear selection on deactivate', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    tool.startSelection(3, 3);
    tool.updateSelection(7, 7);
    tool.deactivate();

    expect(tool.getSelectionBounds()).toBeNull();
  });

  // Test 11: Selection with large canvas and verify all coordinates
  runner.it('should handle large selections and verify all cell coordinates', () => {
    const tool = new SelectTool();
    const canvas = {
      width: 200,
      height: 100,
      getCell: (x, y) => ({ glyph: 42, fg: [255, 255, 255], bg: [0, 0, 0] }),
    };
    tool.setCanvas(canvas);

    tool.startSelection(10, 10);
    tool.updateSelection(12, 12);

    const bounds = tool.getSelectionBounds();
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(10);
    expect(bounds.width).toBe(3); // 12 - 10 + 1
    expect(bounds.height).toBe(3);

    // Verify all cells in selection
    const cells = tool.getSelectedCells();
    expect(cells.length).toBe(9); // 3x3 grid

    // Verify coordinates are correct
    const cellCoords = new Set(cells.map(c => `${c.x},${c.y}`));
    for (let x = 10; x <= 12; x++) {
      for (let y = 10; y <= 12; y++) {
        expect(cellCoords.has(`${x},${y}`)).toBeTruthy(`Expected (${x},${y}) in selection`);
      }
    }
  });

  // Test 12: Multiple selection updates and verify consistency
  runner.it('should maintain consistent state across multiple updates', () => {
    const tool = new SelectTool();
    const canvas = { width: 80, height: 24 };
    tool.setCanvas(canvas);

    // First selection
    tool.startSelection(0, 0);
    tool.updateSelection(2, 2);
    let bounds = tool.getSelectionBounds();
    expect(bounds.width).toBe(3);
    expect(bounds.height).toBe(3);

    // Update to different bounds
    tool.clearSelection();
    tool.startSelection(5, 5);
    tool.updateSelection(10, 10);
    bounds = tool.getSelectionBounds();
    expect(bounds.x).toBe(5);
    expect(bounds.y).toBe(5);
    expect(bounds.width).toBe(6); // 10 - 5 + 1
    expect(bounds.height).toBe(6);

    // Verify isSelected works with new bounds
    expect(tool.isSelected(5, 5)).toBeTruthy();
    expect(tool.isSelected(10, 10)).toBeTruthy();
    expect(tool.isSelected(0, 0)).toBeFalsy(); // Outside new bounds
    expect(tool.isSelected(2, 2)).toBeFalsy(); // Outside new bounds
  });
});

runner.report();
