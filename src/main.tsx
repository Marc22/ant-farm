import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing in index.html')
ReactDOM.render(<App />, container)
