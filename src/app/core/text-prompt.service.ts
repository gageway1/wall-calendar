import { Injectable, signal } from '@angular/core';

export interface TextPromptOptions {
  title: string;
  value?: string;
  placeholder?: string;
  /** One-tap choices shown under the field (filtered as you type). */
  suggestions?: string[];
  maxLength?: number;
  /** Label for the confirm button. */
  confirm?: string;
  /** Show a "Clear" button that resolves with ''. */
  allowClear?: boolean;
}

interface PendingPrompt extends TextPromptOptions {
  resolve: (value: string | null) => void;
}

/**
 * Ask for a line of text with the wall's keyboard. Resolves with the text, '' when cleared, or
 * null when cancelled.
 */
@Injectable({ providedIn: 'root' })
export class TextPromptService {
  readonly current = signal<PendingPrompt | null>(null);

  ask(options: TextPromptOptions): Promise<string | null> {
    this.current()?.resolve(null);
    return new Promise((resolve) => this.current.set({ ...options, resolve }));
  }

  finish(value: string | null) {
    const p = this.current();
    this.current.set(null);
    p?.resolve(value);
  }
}
