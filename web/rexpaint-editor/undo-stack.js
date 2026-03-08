/**
 * Undo/Redo Stack
 *
 * Maintains two stacks (undo and redo) with a maximum history size.
 * Provides LIFO semantics: pushing a new action clears the redo stack.
 */

export class UndoStack {
  /**
   * Create a new UndoStack instance.
   *
   * @param {number} maxSize - Maximum number of actions to keep in history (default: 50)
   */
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  /**
   * Push a snapshot onto the undo stack.
   * Clears the redo stack (standard undo/redo behavior).
   * Removes oldest action if maxSize is exceeded.
   *
   * @param {*} snapshot - Any serializable snapshot object representing the state
   */
  push(snapshot) {
    if (this.undoStack.length >= this.maxSize) {
      this.undoStack.shift(); // Remove oldest
    }
    this.undoStack.push(snapshot);
    this.redoStack = []; // Clear redo when new action taken
  }

  /**
   * Check if undo is available.
   *
   * @returns {boolean} true if undo stack is not empty
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available.
   *
   * @returns {boolean} true if redo stack is not empty
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Undo the last action.
   * Moves the last action from undo stack to redo stack.
   * Returns the previous state (new top of undo stack).
   *
   * @returns {*} The snapshot representing the previous state, or null if undo stack is empty
   */
  undo() {
    if (!this.canUndo()) return null;
    const snapshot = this.undoStack.pop();
    this.redoStack.push(snapshot);
    return this.undoStack[this.undoStack.length - 1];
  }

  /**
   * Redo the last undone action.
   * Moves the last action from redo stack to undo stack.
   * Returns the restored snapshot.
   *
   * @returns {*} The snapshot representing the restored state, or null if redo stack is empty
   */
  redo() {
    if (!this.canRedo()) return null;
    const snapshot = this.redoStack.pop();
    this.undoStack.push(snapshot);
    return snapshot;
  }

  /**
   * Clear both undo and redo stacks.
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
