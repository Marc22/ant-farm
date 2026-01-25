import React from 'react'
import { Todo } from './types'

type Props = {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export default function TodoItem({ todo, onToggle, onDelete }: Props) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="checkbox" checked={todo.completed} onChange={() => onToggle(todo.id)} />
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.text}</span>
      <button onClick={() => onDelete(todo.id)} style={{ marginLeft: 'auto' }}>Delete</button>
    </li>
  )
}
