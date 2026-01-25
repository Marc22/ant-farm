import React, { useState } from 'react'
import { Todo } from './types'
import TodoItem from './TodoItem'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function TodoApp(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const newTodo: Todo = { id: uid(), text: text.trim(), completed: false }
    setTodos((s) => [newTodo, ...s])
    setText('')
  }

  function toggleTodo(id: string) {
    setTodos((s) => s.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  function deleteTodo(id: string) {
    setTodos((s) => s.filter(t => t.id !== id))
  }

  return (
    <section style={{ maxWidth: 600 }}>
      <form onSubmit={addTodo} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a todo" style={{ width: 320 }} />
        <button type="submit">Add</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {todos.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
        ))}
      </ul>
    </section>
  )
}
