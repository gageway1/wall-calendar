import { Component, computed, effect, inject, signal } from '@angular/core';
import { KeyboardService } from '../core/keyboard.service';
import { TextPromptService } from '../core/text-prompt.service';
import { Icon } from './icon';
import { Osk, OskKey } from './osk';

const MAX_SUGGESTIONS = 10;

@Component({
  selector: 'app-text-prompt',
  imports: [Icon, Osk],
  templateUrl: './text-prompt.html',
  styleUrl: './text-prompt.scss',
  host: { '(document:keydown.escape)': 'cancel()' },
})
export class TextPrompt {
  protected readonly prompts = inject(TextPromptService);
  protected readonly keyboard = inject(KeyboardService);
  protected readonly value = signal('');

  constructor() {
    effect(() => this.value.set(this.prompts.current()?.value ?? ''));
  }

  protected readonly autoCap = computed(() => {
    const t = this.value();
    return t === '' || /[.!?]\s$/.test(t);
  });

  /** Filters by what's typed; an untouched prefilled value shows every suggestion. */
  protected readonly suggestions = computed(() => {
    const p = this.prompts.current();
    const typed = this.value() !== (p?.value ?? '');
    const q = typed ? this.value().trim().toLowerCase() : '';
    return (this.prompts.current()?.suggestions ?? [])
      .filter((s) => !q || (s.toLowerCase() !== q && s.toLowerCase().includes(q)))
      .slice(0, MAX_SUGGESTIONS);
  });

  protected onKey(k: OskKey) {
    const max = this.prompts.current()?.maxLength ?? 120;
    if (k.type === 'char') this.value.update((t) => (t.length < max ? t + k.value : t));
    else if (k.type === 'backspace') this.value.update((t) => t.slice(0, -1));
    else this.save();
  }

  protected save() {
    const v = this.value().trim();
    if (v) this.prompts.finish(v);
  }

  protected cancel() {
    if (this.prompts.current()) this.prompts.finish(null);
  }
}
