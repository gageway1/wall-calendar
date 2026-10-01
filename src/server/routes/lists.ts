import express from 'express';
import {
  clearCompleted,
  createTaskList,
  deleteTask,
  insertTask,
  listTaskHistory,
  listTaskLists,
  listTasks,
  setTaskDone,
} from '../google/tasks-api';

/** Shared lists (groceries etc.) backed by Google Tasks, so phones see the same lists. */
export const lists = express.Router();

const MAX_TITLE = 200;

lists.get('/', async (_req, res) => {
  res.json(await listTaskLists());
});

lists.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title || title.length > MAX_TITLE) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  res.status(201).json(await createTaskList(title));
});

lists.get('/:listId/items', async (req, res) => {
  const items = await listTasks(req.params.listId);
  res.json(
    items
      // Google orders by `position`; keep that for open items, newest-completed first for done.
      .sort((a, b) =>
        a.status !== b.status
          ? a.status === 'needsAction'
            ? -1
            : 1
          : a.status === 'completed'
            ? (b.completed ?? '').localeCompare(a.completed ?? '')
            : (a.position ?? '').localeCompare(b.position ?? ''),
      )
      .map((t) => ({ id: t.id, title: t.title.trim(), done: t.status === 'completed' })),
  );
});

/** Things bought before, most frequent first, for one-tap re-adding. */
lists.get('/:listId/suggestions', async (req, res) => {
  const counts = new Map<string, { title: string; n: number }>();
  for (const t of await listTaskHistory(req.params.listId)) {
    const key = t.title.trim().toLowerCase();
    const entry = counts.get(key) ?? { title: t.title.trim(), n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  res.json(
    [...counts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 30)
      .map((e) => e.title),
  );
});

lists.post('/:listId/items', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title || title.length > MAX_TITLE) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const t = await insertTask(req.params.listId, title);
  res.status(201).json({ id: t.id, title: t.title, done: false });
});

lists.patch('/:listId/items/:taskId', async (req, res) => {
  if (typeof req.body?.done !== 'boolean') {
    res.status(400).json({ error: 'done must be a boolean' });
    return;
  }
  await setTaskDone(req.params.listId, req.params.taskId, req.body.done);
  res.status(204).end();
});

lists.delete('/:listId/items/:taskId', async (req, res) => {
  await deleteTask(req.params.listId, req.params.taskId);
  res.status(204).end();
});

lists.post('/:listId/clear', async (req, res) => {
  await clearCompleted(req.params.listId);
  res.status(204).end();
});
