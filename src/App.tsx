import React from 'react'
import TodoApp from './components/TodoApp'

export default function App(): JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <h1>Ant Farm Todo List...</h1>
      <TodoApp />
    </main>
  )
}
