import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TextPromptService } from '../core/text-prompt.service';
import { ToastService } from '../core/toast.service';

interface TaskList {
  id: string;
  title: string;
}

interface Item {
  id: string;
  title: string;
  done: boolean;
}

type Setup = 'ok' | 'loading' | 'not_connected' | 'scope_missing' | 'api_disabled' | 'offline';

const SELECTED_KEY = 'wall.list';
const REFRESH_MS = 30 * 1000;

/** Google Tasks lists (groceries, packing, to-dos) — the same lists as the Tasks app on phones. */
@Component({
  selector: 'app-lists',
  templateUrl: './lists.html',
  styleUrl: './lists.scss',
})
export class Lists implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly prompt = inject(TextPromptService);
  private readonly toasts = inject(ToastService);

  protected readonly setup = signal<Setup>('loading');
  protected readonly lists = signal<TaskList[]>([]);
  protected readonly selectedId = signal<string | null>(loadSelected());
  protected readonly items = signal<Item[]>([]);
  private readonly timer = setInterval(() => this.loadItems(), REFRESH_MS);

  protected readonly selected = computed(
    () => this.lists().find((l) => l.id === this.selectedId()) ?? this.lists()[0] ?? null,
  );
  protected readonly open = computed(() => this.items().filter((i) => !i.done));
  protected readonly done = computed(() => this.items().filter((i) => i.done));

  constructor() {
    this.loadLists();
    effect(() => {
      if (this.selected()) this.loadItems();
    });
  }

  private loadLists() {
    this.http.get<TaskList[]>('/api/lists').subscribe({
      next: (l) => {
        this.lists.set(l);
        this.setup.set('ok');
      },
      error: (err: HttpErrorResponse) => this.setup.set(setupState(err)),
    });
  }

  protected loadItems() {
    const list = this.selected();
    if (!list) return;
    this.http.get<Item[]>(`/api/lists/${enc(list.id)}/items`).subscribe({
      next: (items) => this.items.set(items),
      error: () => {},
    });
  }

  protected choose(list: TaskList) {
    this.selectedId.set(list.id);
    this.items.set([]);
    try {
      localStorage.setItem(SELECTED_KEY, list.id);
    } catch {}
  }

  /** Keeps asking so a whole grocery run can be typed in one go; Cancel ends it. */
  protected async add() {
    const list = this.selected();
    if (!list) return;
    const suggestions = await firstValueFrom(
      this.http.get<string[]>(`/api/lists/${enc(list.id)}/suggestions`),
    ).catch(() => [] as string[]);

    for (;;) {
      const onList = new Set(this.open().map((i) => i.title.toLowerCase()));
      const title = await this.prompt.ask({
        title: `Add to ${list.title}`,
        placeholder: 'Item',
        suggestions: suggestions.filter((s) => !onList.has(s.toLowerCase())),
        confirm: 'Add',
        maxLength: 200,
      });
      if (!title) return;
      try {
        const item = await firstValueFrom(
          this.http.post<Item>(`/api/lists/${enc(list.id)}/items`, { title }),
        );
        this.items.update((items) => [item, ...items]);
        this.toasts.success(`Added ${title}`);
      } catch {
        return; // The interceptor already showed the error.
      }
    }
  }

  protected toggle(item: Item) {
    const list = this.selected();
    if (!list) return;
    const done = !item.done;
    this.items.update((items) => items.map((i) => (i.id === item.id ? { ...i, done } : i)));
    this.http.patch(`/api/lists/${enc(list.id)}/items/${enc(item.id)}`, { done }).subscribe({
      error: () => this.loadItems(),
    });
  }

  protected remove(item: Item) {
    const list = this.selected();
    if (!list) return;
    this.items.update((items) => items.filter((i) => i.id !== item.id));
    this.http.delete(`/api/lists/${enc(list.id)}/items/${enc(item.id)}`).subscribe({
      next: () => this.toasts.success(`Removed ${item.title}`),
      error: () => this.loadItems(),
    });
  }

  protected clearDone() {
    const list = this.selected();
    if (!list) return;
    const n = this.done().length;
    this.items.update((items) => items.filter((i) => !i.done));
    this.http.post(`/api/lists/${enc(list.id)}/clear`, {}).subscribe({
      next: () => this.toasts.success(`Cleared ${n} done ${n === 1 ? 'item' : 'items'}`),
      error: () => this.loadItems(),
    });
  }

  protected async newList() {
    const title = await this.prompt.ask({
      title: 'New list',
      placeholder: 'e.g. Groceries',
      confirm: 'Create',
      maxLength: 60,
    });
    if (!title) return;
    this.http.post<TaskList>('/api/lists', { title }).subscribe((l) => {
      this.lists.update((ls) => [...ls, l]);
      this.choose(l);
      this.toasts.success(`Created ${title}`);
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

const enc = encodeURIComponent;

function setupState(err: HttpErrorResponse): Setup {
  const code = err.error?.error;
  if (code === 'google_not_connected') return 'not_connected';
  if (code === 'google_scope_missing') return 'scope_missing';
  if (code === 'google_api_disabled') return 'api_disabled';
  return 'offline';
}

function loadSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}
