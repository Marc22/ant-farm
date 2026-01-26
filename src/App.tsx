import React from 'react'
import AntFarm from './components/AntFarm'
import './index.css'

export default function App(): JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
  <h1 style={{ marginBottom: 8 }}>Ant Farm</h1>
  <AntFarm />
    </main>
  )
}
