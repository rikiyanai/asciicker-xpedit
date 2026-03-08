/**
 * Undo/Redo Stack Tests
 *
 * Run with: node tests/web/rexpaint-editor-undo-stack.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-undo-stack.test.js
 */

import { UndoStack } from '../../web/rexpaint-editor/undo-stack.js';

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
  toBeNull() {
    if (value !== null) {
      throw new Error(`Expected null, got ${value}`);
    }
  },
  toBeUndefined() {
    if (value !== undefined) {
      throw new Error(`Expected undefined, got ${value}`);
    }
  },
});

// Run tests
const runner = new TestRunner();

runner.describe('UndoStack', () => {
  runner.it('should create an instance with default maxSize of 50', () => {
    const stack = new UndoStack();
    expect(stack.maxSize).toBe(50);
  });

  runner.it('should create an instance with custom maxSize', () => {
    const stack = new UndoStack(30);
    expect(stack.maxSize).toBe(30);
  });

  runner.it('Test 1: Push snapshot to undo stack', () => {
    const stack = new UndoStack();
    const snapshot = { x: 5, y: 10 };
    stack.push(snapshot);
    expect(stack.undoStack.length).toBe(1);
    expect(stack.undoStack[0]).toEqual(snapshot);
  });

  runner.it('Test 2: canUndo() returns true after push', () => {
    const stack = new UndoStack();
    const snapshot = { x: 5, y: 10 };
    stack.push(snapshot);
    expect(stack.canUndo()).toBeTruthy();
  });

  runner.it('Test 3: canUndo() returns false on empty stack', () => {
    const stack = new UndoStack();
    expect(stack.canUndo()).toBeFalsy();
  });

  runner.it('Test 4: undo() returns previous state and moves to redo', () => {
    const stack = new UndoStack();
    const snapshot1 = { x: 1, y: 1 };
    const snapshot2 = { x: 2, y: 2 };

    stack.push(snapshot1);
    stack.push(snapshot2);

    // After 2 pushes: undoStack = [snap1, snap2], redoStack = []
    // undo() should:
    // 1. Pop snap2 from undoStack
    // 2. Push snap2 to redoStack
    // 3. Return snap1 (current top of undoStack)
    const undoResult = stack.undo();
    expect(undoResult).toEqual(snapshot1);
    expect(stack.redoStack.length).toBe(1);
    expect(stack.redoStack[0]).toEqual(snapshot2);
  });

  runner.it('Test 5: canRedo() returns true after undo', () => {
    const stack = new UndoStack();
    stack.push({ x: 1 });
    stack.push({ x: 2 });

    stack.undo();
    expect(stack.canRedo()).toBeTruthy();
  });

  runner.it('Test 6: redo() restores undone state', () => {
    const stack = new UndoStack();
    const snapshot1 = { x: 1, y: 1 };
    const snapshot2 = { x: 2, y: 2 };

    stack.push(snapshot1);
    stack.push(snapshot2);
    stack.undo();

    // After undo: undoStack = [snap1], redoStack = [snap2]
    // redo() should:
    // 1. Pop snap2 from redoStack
    // 2. Push snap2 to undoStack
    // 3. Return snap2
    const redoResult = stack.redo();
    expect(redoResult).toEqual(snapshot2);
    expect(stack.undoStack.length).toBe(2);
    expect(stack.undoStack[1]).toEqual(snapshot2);
  });

  runner.it('Test 7: New push after undo clears redo stack', () => {
    const stack = new UndoStack();
    stack.push({ x: 1 });
    stack.push({ x: 2 });
    stack.undo();

    expect(stack.canRedo()).toBeTruthy();

    stack.push({ x: 3 });

    // After new push, redo stack should be cleared
    expect(stack.canRedo()).toBeFalsy();
    expect(stack.redoStack.length).toBe(0);
  });

  runner.it('Test 8: Enforces max size (50), removes oldest', () => {
    const stack = new UndoStack(5); // Small max size for testing

    // Push 6 snapshots
    for (let i = 0; i < 6; i++) {
      stack.push({ id: i });
    }

    // Stack should only have 5 items, oldest (id: 0) should be removed
    expect(stack.undoStack.length).toBe(5);
    expect(stack.undoStack[0]).toEqual({ id: 1 });
    expect(stack.undoStack[4]).toEqual({ id: 5 });
  });

  runner.it('Test 9: undo() returns null on empty stack', () => {
    const stack = new UndoStack();
    const result = stack.undo();
    expect(result).toBeNull();
  });

  runner.it('Test 10: clear() empties both stacks', () => {
    const stack = new UndoStack();
    stack.push({ x: 1 });
    stack.push({ x: 2 });
    stack.undo();

    expect(stack.canUndo()).toBeTruthy();
    expect(stack.canRedo()).toBeTruthy();

    stack.clear();

    expect(stack.canUndo()).toBeFalsy();
    expect(stack.canRedo()).toBeFalsy();
    expect(stack.undoStack.length).toBe(0);
    expect(stack.redoStack.length).toBe(0);
  });

  runner.it('should handle complex undo/redo flow with successive operations', () => {
    const stack = new UndoStack();
    const snap1 = { id: 1 };
    const snap2 = { id: 2 };
    const snap3 = { id: 3 };

    // Push creates states in undo stack
    stack.push(snap1);
    stack.push(snap2);
    stack.push(snap3);
    expect(stack.undoStack.length).toBe(3);

    // Multiple undos
    stack.undo();
    stack.undo();
    expect(stack.undoStack.length).toBe(1);
    expect(stack.redoStack.length).toBe(2);

    // Multiple redos
    stack.redo();
    stack.redo();
    expect(stack.undoStack.length).toBe(3);
    expect(stack.redoStack.length).toBe(0);
  });

  runner.it('redo() returns null on empty redo stack', () => {
    const stack = new UndoStack();
    const result = stack.redo();
    expect(result).toBeNull();
  });

  runner.it('should handle multiple undos in sequence', () => {
    const stack = new UndoStack();
    stack.push({ id: 1 });
    stack.push({ id: 2 });
    stack.push({ id: 3 });

    const result1 = stack.undo(); // Should return {id: 2}
    const result2 = stack.undo(); // Should return {id: 1}

    expect(result1).toEqual({ id: 2 });
    expect(result2).toEqual({ id: 1 });
    expect(stack.undoStack.length).toBe(1);
    expect(stack.redoStack.length).toBe(2);
  });

  runner.it('should handle multiple redos in sequence', () => {
    const stack = new UndoStack();
    stack.push({ id: 1 });
    stack.push({ id: 2 });
    stack.push({ id: 3 });

    stack.undo();
    stack.undo();

    const result1 = stack.redo(); // Should return {id: 2}
    const result2 = stack.redo(); // Should return {id: 3}

    expect(result1).toEqual({ id: 2 });
    expect(result2).toEqual({ id: 3 });
    expect(stack.undoStack.length).toBe(3);
    expect(stack.redoStack.length).toBe(0);
  });

  runner.it('should accept complex snapshot objects', () => {
    const stack = new UndoStack();
    const complexSnapshot = {
      cells: [
        { x: 0, y: 0, glyph: 65, fg: [255, 0, 0], bg: [0, 0, 0] },
        { x: 1, y: 1, glyph: 66, fg: [0, 255, 0], bg: [255, 255, 255] },
      ],
      metadata: { timestamp: 1234567890, toolActive: 'cell' },
    };

    stack.push(complexSnapshot);
    expect(stack.undoStack[0]).toEqual(complexSnapshot);
  });
});

runner.report();
