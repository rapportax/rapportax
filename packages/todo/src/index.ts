export interface TodoItem {
  id: string;
  title: string;
  createdAt: Date;
}

export function createTodo(title: string): TodoItem {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date(),
  };
}
