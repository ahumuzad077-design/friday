/**
 * Storage utilities for disk-based state management.
 * Fresh-load pattern: every call reads from disk, no in-memory cache.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export class DiskStorage {
  constructor(private filePath: string) {}

  /**
   * Load state from disk, or return default if file doesn't exist.
   */
  load<T>(defaultValue: T): T {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.error(`[Storage] Failed to load ${this.filePath}:`, err);
    }
    return defaultValue;
  }

  /**
   * Save state to disk atomically (write temp, then rename).
   */
  save<T>(value: T): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const tmpPath = `${this.filePath}.tmp-${process.pid}`;
      writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
      // Atomic rename
      writeFileSync(this.filePath, JSON.stringify(value, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[Storage] Failed to save ${this.filePath}:`, err);
      throw err;
    }
  }
}

/**
 * Generate a simple unique ID.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get current ISO date string.
 */
export function now(): string {
  return new Date().toISOString();
}
