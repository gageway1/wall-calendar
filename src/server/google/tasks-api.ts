import { googleRequest } from './http';

/** Google Tasks: the lists behind the wall's Lists screen (and the Google Tasks app on phones). */
const API = 'https://tasks.googleapis.com/tasks/v1';

export interface GTaskList {
  id: string;
  title: string;
}

export interface GTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  completed?: string;
  position?: string;
  updated?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
}

const enc = encodeURIComponent;

export async function listTaskLists(): Promise<GTaskList[]> {
  const res = await googleRequest<{ items?: GTaskList[] }>(`${API}/users/@me/lists`, {
    maxResults: '100',
  });
  return res.items ?? [];
}

export function createTaskList(title: string) {
  return googleRequest<GTaskList>(
    `${API}/users/@me/lists`,
    {},
    { method: 'POST', body: { title } },
  );
}

/** Open items, plus completed ones that haven't been cleared yet. */
export async function listTasks(listId: string): Promise<GTask[]> {
  const all: GTask[] = [];
  let pageToken: string | undefined;
  do {
    const page = await googleRequest<{ items?: GTask[]; nextPageToken?: string }>(
      `${API}/lists/${enc(listId)}/tasks`,
      { showCompleted: 'true', showHidden: 'false', maxResults: '100', pageToken },
    );
    all.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all.filter((t) => !t.deleted && t.title?.trim());
}

/** Completed items including cleared ones: the history behind "add it again" suggestions. */
export async function listTaskHistory(listId: string): Promise<GTask[]> {
  const page = await googleRequest<{ items?: GTask[] }>(`${API}/lists/${enc(listId)}/tasks`, {
    showCompleted: 'true',
    showHidden: 'true',
    maxResults: '100',
  });
  return (page.items ?? []).filter((t) => !t.deleted && t.title?.trim());
}

export function insertTask(listId: string, title: string) {
  return googleRequest<GTask>(
    `${API}/lists/${enc(listId)}/tasks`,
    {},
    { method: 'POST', body: { title } },
  );
}

export function setTaskDone(listId: string, taskId: string, done: boolean) {
  return googleRequest<GTask>(
    `${API}/lists/${enc(listId)}/tasks/${enc(taskId)}`,
    {},
    // Un-completing needs `completed` cleared too, or Google keeps the old timestamp.
    {
      method: 'PATCH',
      body: done ? { status: 'completed' } : { status: 'needsAction', completed: null },
    },
  );
}

export function deleteTask(listId: string, taskId: string) {
  return googleRequest<void>(
    `${API}/lists/${enc(listId)}/tasks/${enc(taskId)}`,
    {},
    { method: 'DELETE' },
  );
}

/** Hides all completed items (they stay in history for suggestions). */
export function clearCompleted(listId: string) {
  return googleRequest<void>(`${API}/lists/${enc(listId)}/clear`, {}, { method: 'POST' });
}
