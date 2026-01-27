import React from 'react'
import './AntFarm.css'
import Ant from './Ant'

export default function AntFarm(): JSX.Element {
  const sandTop = 210
  const sandLeft = 20
  const sandRight = 580

  const [holes, setHoles] = React.useState<Array<{ x: number; y: number; r: number }>>([])
  const [tunnelPaths, setTunnelPaths] = React.useState<Array<{ id: number; points: Array<{ x: number; y: number }>, r: number }>>([])
  const [grains, setGrains] = React.useState<Array<{ x: number; y: number; r: number; yv: number; vx: number; settled?: boolean }>>([])
  const [tunnelGrains, setTunnelGrains] = React.useState<Array<{ x: number; y: number; r: number; tunnelId: number }>>([])
  const carriedRef = React.useRef<Array<{ x: number; y: number; r: number }>>([])
  const [antPos, setAntPos] = React.useState<{ x: number; y: number; digging?: boolean } | null>(null)
  const [isDigging, setIsDigging] = React.useState(false)
  const [antMode, setAntMode] = React.useState<string>('surface')
  const [resetSignal, setResetSignal] = React.useState(0)
  const [forceEnterTunnel, setForceEnterTunnel] = React.useState(0)
  const tunnelRoomThresholdsRef = React.useRef<Map<number, number>>(new Map())  // tunnelId -> threshold length for room
  const tunnelHasRoomRef = React.useRef<Set<number>>(new Set())  // tunnelIds that already have a room built
  const [ants, setAnts] = React.useState<Array<{ id: number; speed: number; color: string }>>([
    { id: 0, speed: 14, color: '#231f20' }  // Starting ant
  ])
  const nextAntIdRef = React.useRef(1)
  const nextTunnelIdRef = React.useRef(0)

  function handleDig(pt: { x: number; y: number }) {
    try { console.debug('[AntFarm] handleDig called', pt) } catch (e) {}
    // start a short diagonal tunnel from the surface point into the sand
    const steps = 8 + Math.floor(Math.random() * 6)
    // pick a diagonal direction: mostly downward, small left/right
    const dx = (Math.random() * 2 - 1) * 10 // horizontal per step
    const dy = 8 + Math.random() * 6 // vertical per step
    const baseR = 3.5 + Math.random() * 2.5  // REDUCED: smaller radius to prevent combining

  // create a curving tunnel: we'll create the tunnel entry immediately
  // so the rendered tunnel appears connected as points are appended.
  let angle = (Math.random() * 2 - 1) * 0.4
  // Reserve a stable tunnel id and add initial tunnel path so the mask shows a connected path
  const tunnelId = nextTunnelIdRef.current++
  setTunnelPaths(tp => [...tp, { id: tunnelId, points: [{ x: pt.x, y: pt.y }], r: baseR }])
  // set a room threshold early for this tunnel id
  const roomThreshold = 15 + Math.floor(Math.random() * 11)
  tunnelRoomThresholdsRef.current.set(tunnelId, roomThreshold)
  try { console.debug('[AntFarm] Creating tunnel', tunnelId, 'with initial point, room will form at length', roomThreshold) } catch(e) {}
    
    // Calculate total time needed for tunnel creation
    const totalTunnelTime = (steps - 1) * 200 + 140 + 200 // last step delay + buffer
    
    for (let i = 0; i < steps; i++) {
      const delay = i * 200 + Math.random() * 140
      setTimeout(() => {
        angle += (Math.random() * 2 - 1) * 0.4
        const x = pt.x + Math.cos(angle) * dx * i
        const y = Math.min(sandTop + 160, pt.y + Math.abs(Math.sin(angle)) * dy * i)
        // only add hole if within sand bounds
        if (x > sandLeft + 4 && x < sandRight - 4 && y > sandTop + 2) {
          const r = baseR * (0.85 + Math.random() * 0.3)  // REDUCED variation
          // add hole as a point for mask
          setHoles(h => [...h, { x, y, r }])

          // append point to the existing tunnel path so it stays connected during creation
          setTunnelPaths(tp => tp.map((t) => t.id === tunnelId ? { ...t, points: [...t.points, { x, y }] } : t))
        }

        // At the last step, add the initial grains at the deep end
        if (i === steps - 1) {
          // Use the computed coordinates for the deep point (avoid reading tunnelPaths state which may race)
          const deepPoint = { x, y }
          const grainCount = 15 + Math.floor(Math.random() * 10)
          const newTunnelGrains = new Array(grainCount).fill(0).map(() => ({
            x: deepPoint.x + (Math.random() * 8 - 4),
            y: deepPoint.y + (Math.random() * 8 - 4),
            r: 1.6 + Math.random() * 2.4,
            tunnelId
          }))
          setTunnelGrains(tg => [...tg, ...newTunnelGrains])
          try { console.debug('[AntFarm] Added', grainCount, 'grains to tunnel', tunnelId) } catch(e) {}
        }
      }, delay)
    }
    
    // Return the total time so caller knows when tunnel is complete
    return totalTunnelTime
  }

  // ant position callback to show carried grains visually and to deposit from ant location
  function handleUpdatePos(p: { x: number; y: number; angle: number; legSwing: number; mode?: string }) {
    setAntPos(prev => ({ x: p.x, y: p.y, digging: prev?.digging }))
    if (p.mode) setAntMode(p.mode)
  }

  // ant digging start/stop handlers to show carried grains attached to ant
  function handleDigStart(pt: { x: number; y: number }) {
    // mark ant as digging (visual only)
    try { console.debug('[AntFarm] digStart', pt) } catch (e) {}
    setAntPos(prev => ({ x: pt.x, y: pt.y, digging: true }))
    setIsDigging(true)
    // call existing logic to make a tunnel and get the time it takes
    const tunnelCompleteTime = handleDig(pt)
    // Store this so handleDigEndFromAnt knows the tunnel is ready
    ;(window as any).lastTunnelCompleteTime = Date.now() + tunnelCompleteTime
    try { console.debug('[AntFarm] Tunnel will be complete at', new Date((window as any).lastTunnelCompleteTime).toISOString()) } catch(e) {}
  }

  function handleDigEndFromAnt() {
    // When digging completes, DON'T deposit grains automatically
    // Instead, the ant should now ENTER the tunnel it just dug and carry grains up one by one
    try { console.debug('[AntFarm] digEndFromAnt - tunnel created, ant should now enter it') } catch (e) {}
    setAntPos(prev => prev ? { ...prev, digging: false } : prev)
    setIsDigging(false)
    
    // Clear the carried buffer since these grains are still "in" the tunnel
    // The ant will pick them up one by one when it descends
    carriedRef.current = []
  }

  // New callbacks for tunnel navigation
  function getTunnelPoints(): Array<{ x: number; y: number }> {
    // Return a random tunnel path that has grains available
    if (tunnelPaths.length === 0) return []
    
    // Find tunnels that have grains
    const tunnelIdsWithGrains = new Set(tunnelGrains.map(g => g.tunnelId))
    const availableTunnels = tunnelPaths.filter(t => tunnelIdsWithGrains.has(t.id))

    if (availableTunnels.length === 0) {
      // No tunnels with grains, return any tunnel
      const randomIdx = Math.floor(Math.random() * tunnelPaths.length)
      return tunnelPaths[randomIdx].points
    }

    // Pick a random tunnel that has grains
    const chosen = availableTunnels[Math.floor(Math.random() * availableTunnels.length)]
    console.log('[AntFarm] getTunnelPoints returning tunnel', chosen.id, 'with', chosen.points.length, 'points')
    return chosen.points
  }

  function handlePickupGrain(tunnelX: number, tunnelY: number) {
    // When ant picks up a grain from tunnel, remove one from tunnelGrains and add to carried
    try { console.debug('[AntFarm] Ant picking up grain near', tunnelX, tunnelY) } catch(e) {}
    
    // Find a grain near this position
    const grainIndex = tunnelGrains.findIndex(g => 
      Math.abs(g.x - tunnelX) < 20 && Math.abs(g.y - tunnelY) < 20
    )
    
    if (grainIndex >= 0) {
      const grain = tunnelGrains[grainIndex]
      // remove the specific grain from the tunnel list
      setTunnelGrains(tg => tg.filter((_, i) => i !== grainIndex))
      carriedRef.current.push({ x: grain.x, y: grain.y, r: grain.r })
      try { console.debug('[AntFarm] Picked up grain! Remaining in tunnels:', tunnelGrains.length - 1) } catch(e) {}

      // EXTEND TUNNEL: Make tunnel longer each time a grain is picked up
      const tunnelId = grain.tunnelId
      const tIdx = tunnelPaths.findIndex(t => t.id === tunnelId)
      if (tIdx >= 0) {
        const latest = tunnelPaths[tIdx]
        if (latest.points.length >= 2) {
          const lastPt = latest.points[latest.points.length - 1]
          const prevPt = latest.points[latest.points.length - 2]
          
          // Check if tunnel has reached its room threshold
          const roomThreshold = tunnelRoomThresholdsRef.current.get(tunnelId) || 20
          const shouldBuildRoom = latest.points.length === roomThreshold && !tunnelHasRoomRef.current.has(tunnelId)
          
          if (shouldBuildRoom) {
            // BUILD A ROOM: Create a wider chamber at the end
            console.log('[AntFarm] Building a room at tunnel end!')
            const roomRadius = latest.r * 2.5  // Bigger radius for room
            const roomPoints: Array<{ x: number; y: number }> = []
            
            // Create circular room with multiple points
            const numRoomPoints = 8
            for (let i = 0; i < numRoomPoints; i++) {
              const angle = (i / numRoomPoints) * Math.PI * 2
              const rx = lastPt.x + Math.cos(angle) * roomRadius * 0.8
              const ry = lastPt.y + Math.sin(angle) * roomRadius * 0.6
              roomPoints.push({ x: rx, y: ry })
              
              // Add holes to create the room chamber
              setHoles(h => [...h, { x: rx, y: ry, r: roomRadius * 0.7 }])
            }
            
            // Add a few grains in the room
            const roomGrainCount = 5 + Math.floor(Math.random() * 5)
            const roomGrains = Array.from({ length: roomGrainCount }, () => ({
              x: lastPt.x + (Math.random() * roomRadius * 1.5 - roomRadius * 0.75),
              y: lastPt.y + (Math.random() * roomRadius * 1.2 - roomRadius * 0.6),
              r: 1.6 + Math.random() * 2.4,
              tunnelId: tunnelId
            }))
            setTunnelGrains(tg => [...tg, ...roomGrains])
            
            // Mark this tunnel as having a room
            tunnelHasRoomRef.current.add(tunnelId)
            console.log('[AntFarm] Room built with', roomGrainCount, 'grains for tunnel', tunnelId)
          } else {
            // MARK: this branch is the 'regular tunnel extension' case
            // Regular tunnel extension
            const dx = lastPt.x - prevPt.x
            const dy = lastPt.y - prevPt.y
            const newX = lastPt.x + dx * 0.6 + (Math.random() * 6 - 3)
            const newY = Math.min(sandTop + 160, lastPt.y + Math.abs(dy) * 0.6 + 4 + Math.random() * 4)
            const newPt = { x: newX, y: newY }

            // Add new point to the correct tunnel (compare by id)
            setTunnelPaths(tp => tp.map((t) => t.id === tunnelId ? { ...t, points: [...t.points, newPt] } : t))

            // Add a hole for the new tunnel segment
            setHoles(h => [...h, { x: newX, y: newY, r: latest.r * 0.9 }])
            
            // BRANCHING: 5% chance to create a fork/branch
            if (Math.random() < 0.05 && latest.points.length >= 8) {
              console.log('[AntFarm] Creating branch from tunnel', tunnelId, 'at point', latest.points.length)
              // Create a new branch tunnel starting from this point
              const branchId = nextTunnelIdRef.current++
              const branchLength = 5 + Math.floor(Math.random() * 5)
              const branchPoints: Array<{ x: number; y: number }> = [{ x: lastPt.x, y: lastPt.y }]
              
              // Branch goes in a different direction
              const branchAngle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25 // -45 to +45 degrees
              
              for (let j = 1; j <= branchLength; j++) {
                const bx = lastPt.x + Math.cos(branchAngle) * 8 * j + (Math.random() * 4 - 2)
                const by = Math.min(sandTop + 160, lastPt.y + Math.abs(Math.sin(branchAngle)) * 8 * j + 4)
                branchPoints.push({ x: bx, y: by })
                setHoles(h => [...h, { x: bx, y: by, r: latest.r * 0.8 }])
              }
              
              // Add the branch as a new tunnel
              setTunnelPaths(tp => [...tp, { id: branchId, points: branchPoints, r: latest.r * 0.8 }])
              
              // Set random room threshold for branch
              const branchRoomThreshold = 15 + Math.floor(Math.random() * 11)
              tunnelRoomThresholdsRef.current.set(branchId, branchRoomThreshold)
              
              // Add grains to branch end
              const branchGrainCount = 8 + Math.floor(Math.random() * 7)
              const deepBranchPt = branchPoints[branchPoints.length - 1]
              const branchGrains = Array.from({ length: branchGrainCount }, () => ({
                x: deepBranchPt.x + (Math.random() * 6 - 3),
                y: deepBranchPt.y + (Math.random() * 6 - 3),
                r: 1.6 + Math.random() * 2.4,
                tunnelId: branchId
              }))
              setTunnelGrains(tg => [...tg, ...branchGrains])
              console.log('[AntFarm] Branch created with', branchGrainCount, 'grains')
            }
            
            // Add new grains at the extended end
            const newGrainCount = 2 + Math.floor(Math.random() * 3)
            const newGrains = Array.from({ length: newGrainCount }, () => ({
              x: newX + (Math.random() * 6 - 3),
              y: newY + (Math.random() * 6 - 3),
              r: 1.6 + Math.random() * 2.4,
              tunnelId: tunnelId
            }))
            setTunnelGrains(tg => [...tg, ...newGrains])
            try { console.debug('[AntFarm] Extended tunnel by 1 point, added', newGrainCount, 'new grains') } catch(e) {}
          }
        }
      }
    } else {
      try { console.debug('[AntFarm] No grain found near', tunnelX, tunnelY, '- total grains:', tunnelGrains.length) } catch(e) {}
    }
  }

  function handleDepositGrain(surfaceX: number, surfaceY: number) {
    // When ant deposits a grain at surface, create falling grain with arc
    try { console.debug('[AntFarm] Ant depositing grain at surface', surfaceX, surfaceY) } catch(e) {}
    if (carriedRef.current.length === 0) return
    const grain = carriedRef.current.pop()
    if (grain) {
      // Make deposited grains slightly bigger so hill grows more visibly
      const falling = {
        x: surfaceX + (Math.random() * 10 - 5),
        y: surfaceY - 2,
        r: grain.r * 1.3,  // Slightly bigger when deposited
        yv: -60 - Math.random() * 30,
        vx: Math.random() * 40 - 20,
        settled: false
      }
      setGrains(curr => [...curr, falling])
    }
  }

  function getCarriedCount(): number {
    // Return the number of grains remaining in tunnels (not the carried buffer)
    // This tells the ant how many more trips are needed
    return tunnelGrains.length
  }

  function handleReset() {
    setHoles([])
    setTunnelPaths([])
    setGrains([])
    setTunnelGrains([])
    carriedRef.current = []
    setIsDigging(false)
    setResetSignal(s => s + 1)
    // reset height map
    heightMapRef.current = new Array(sandRight - sandLeft + 1).fill(0)
    // Reset to one ant
    setAnts([{ id: 0, speed: 14, color: '#231f20' }])
    nextAntIdRef.current = 1
    nextTunnelIdRef.current = 0
    tunnelRoomThresholdsRef.current.clear()
    tunnelHasRoomRef.current.clear()
  }

  function addAnt() {
    const newId = nextAntIdRef.current++
    const colors = ['#231f20', '#8B4513', '#654321', '#3d2817', '#5C4033']
    const color = colors[newId % colors.length]
    const speed = 12 + Math.random() * 6  // Random speed 12-18
    setAnts(a => [...a, { id: newId, speed, color }])
    console.log('[AntFarm] Added ant', newId, 'with speed', speed.toFixed(1), 'color', color)
  }

  // heightMap-based grain physics: grains fall and settle into columns to form hills
  const heightMapRef = React.useRef<number[]>(new Array(sandRight - sandLeft + 1).fill(0))
  React.useEffect(() => {
    let raf: number | null = null
    let last: number | null = null
    const g = 900 // px/s^2
    const maxSlope = 0.8 // max height difference between adjacent columns before grain rolls

    const step = (now: number) => {
      if (last == null) last = now
      const dt = (now - last) / 1000
      last = now
      setGrains(prev => {
        if (prev.length === 0) return prev
        const next = prev.map(p => ({ ...p }))
        for (let i = 0; i < next.length; i++) {
          const p = next[i]
          if (p.settled) continue
          p.yv += g * dt
          p.y += p.yv * dt
          p.x += (p.vx || 0) * dt
          // clamp within sand bounds
          if (p.x < sandLeft + 2) p.x = sandLeft + 2
          if (p.x > sandRight - 2) p.x = sandRight - 2
          const bin = Math.round(p.x - sandLeft)
          const columnHeight = heightMapRef.current[bin] || 0
          const targetY = sandTop - columnHeight - p.r * 0.5
          if (p.y >= targetY) {
            // Check if grain should roll to a lower adjacent column (realistic hill formation)
            const leftBin = Math.max(0, bin - 1)
            const rightBin = Math.min(heightMapRef.current.length - 1, bin + 1)
            const leftHeight = heightMapRef.current[leftBin] || 0
            const rightHeight = heightMapRef.current[rightBin] || 0
            
            // Find the lowest neighbor
            let rollTo = -1
            let lowestHeight = columnHeight
            if (leftHeight < lowestHeight - maxSlope * p.r) {
              lowestHeight = leftHeight
              rollTo = leftBin
            }
            if (rightHeight < lowestHeight - maxSlope * p.r) {
              lowestHeight = rightHeight
              rollTo = rightBin
            }
            
            if (rollTo >= 0 && Math.random() < 0.7) {
              // Roll to the lower column
              p.x = sandLeft + rollTo + (Math.random() * 2 - 1)
              p.y = sandTop - lowestHeight - p.r * 0.5
              p.yv = 0
              p.settled = true
              heightMapRef.current[rollTo] = (heightMapRef.current[rollTo] || 0) + p.r * 1.2  // Increased contribution
            } else {
              // Settle in current column
              p.y = targetY
              p.yv = 0
              p.settled = true
              // increase heightmap
              heightMapRef.current[bin] = (heightMapRef.current[bin] || 0) + p.r * 1.4  // Increased contribution
            }
          }
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div>
      {/* Debug HUD */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        background: 'rgba(0,0,0,0.7)', 
        color: '#0f0', 
        padding: '8px 12px', 
        fontFamily: 'monospace', 
        fontSize: '11px', 
        borderRadius: 4,
        zIndex: 1000,
        lineHeight: 1.5
      }}>
        <div>Ants: {ants.length}</div>
        <div>Ant: {antPos ? `(${Math.round(antPos.x)}, ${Math.round(antPos.y)})` : 'N/A'}</div>
        <div>Mode: <strong>{antMode}</strong></div>
        <div>Active: {isDigging ? 'Digging' : (antMode === 'descending' || antMode === 'ascending' ? 'In Tunnel' : 'Walking')}</div>
        <div>Carried: {carriedRef.current.length} grains</div>
        <div>In Tunnels: {tunnelGrains.length} grains</div>
        <div>Settled: {grains.filter(g => g.settled).length}/{grains.length}</div>
        <div>Tunnels: {tunnelPaths.length} paths, {holes.length} holes</div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <button onClick={() => { 
          console.log('[AntFarm] force dig clicked')
          const pt = antPos ? { x: antPos.x, y: antPos.y } : { x: (sandLeft + sandRight) / 2, y: sandTop }
          handleDigStart(pt)
          // After tunnel is created (allow time for async creation), force ant to enter
          setTimeout(() => {
            console.log('[AntFarm] Triggering forceEnterTunnel')
            setForceEnterTunnel(f => f + 1)
          }, 3000)  // Wait for tunnel to be fully created
        }} style={{ marginBottom: 8 }}>Force Dig</button>
        <button onClick={() => {
          console.log('[AntFarm] Force Enter Tunnel clicked')
          setForceEnterTunnel(f => f + 1)
        }} style={{ marginBottom: 8 }}>Enter Tunnel</button>
        <button onClick={addAnt} style={{ marginBottom: 8 }}>Add Ant</button>
        <button onClick={handleReset} style={{ marginBottom: 8 }}>Reset</button>
      </div>
      <div className="antfarm-root" role="img" aria-label="Ant farm">
      <svg className="antfarm-svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <g transform="scale(0.935)">
        {/* frame */}
        <rect x="10" y="10" width="580" height="380" rx="18" ry="18" className="frame" />

        {/* glass highlight */}
        <path d="M30 30 C80 10, 150 10, 200 30" stroke="#ffffff55" strokeWidth="6" fill="none" className="glass" />

        {/* sand (bottom half) */}
        {/* sand uses mask so holes show through */}
        <defs>
          <mask id="sandMask">
            <rect x="0" y="0" width="600" height="400" fill="#fff" />
            {/* render circles for individual holes */}
            {holes.map((h, i) => (
              <circle key={`hole-${i}`} cx={h.x} cy={h.y} r={h.r} fill="#000" />
            ))}
            {/* render smooth tunnel paths */}
            {tunnelPaths.map((tp, i) => {
              if (tp.points.length < 2) return null
              const pathD = tp.points.map((p, idx) => 
                idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
              ).join(' ')
              return (
                <path 
                  key={`tunnel-${i}`} 
                  d={pathD} 
                  stroke="#000" 
                  strokeWidth={tp.r * 2} 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none" 
                />
              )
            })}
          </mask>
        </defs>
        <rect x="20" y="210" width="560" height="170" className="sand" mask="url(#sandMask)" />

  {/* skyline silhouette across the top of the sand (with a valley near the middle) */}
  {/* the silhouette stays at or above y=210 so it doesn't go under the sand */}
  <path id="horizonPath" className="horizon-silhouette" d="M28 210 C80 195, 140 200, 200 206 C240 208, 280 208, 320 206 C360 204, 420 200, 572 210 L572 210 L28 210 Z" />

  {/* motion path for the ant (just above the sand top) */}
  <path id="horizonPathMotion" d="M28 210 C80 205, 140 208, 200 210 C240 210, 280 210, 320 210 C360 210, 420 208, 572 210" fill="none" stroke="none" />

        {/* a simple sand texture: repeated small circles */}
        <g className="sand-grain" mask="url(#sandMask)">
          {Array.from({ length: 80 }).map((_, i) => {
            const cx = 30 + (i * 67) % 540
            const cy = 220 + ((i * 37) % 140)
            const r = 1 + (i % 3)
            return <circle key={i} cx={cx} cy={cy} r={r} fill="#caa97a" opacity={0.9} />
          })}
        </g>

        {/* small farm structures along the sand horizon (green) */}
        <g className="structures" transform="translate(0,0)">
          {/* barn - positioned to sit on the sand horizon (top of sand at y=210) */}
          {/* barn group: internal height ~40 scaled 0.6 -> 24, place so bottom ~210 => translateY = 210 - 24 = 186 (allow slight overlap) */}
          <g transform="translate(120,186) scale(0.6)">
            <rect x="0" y="0" width="60" height="40" rx="3" className="structure-fill" />
            <polygon points="-6,0 30,-18 66,0" className="structure-fill" />
            <rect x="22" y="18" width="16" height="22" fill="#fff" />
          </g>

          {/* tractor (simplified) - smaller and sits on horizon */}
          {/* tractor: internal height ~28 scaled 0.55 -> 15.4 => translateY = 210 - 15.4 = 194 */}
          <g transform="translate(300,194) scale(0.55)">
            <rect x="0" y="8" width="36" height="16" rx="3" className="structure-fill" />
            <circle cx="8" cy="28" r="6" className="structure-fill" />
            <circle cx="28" cy="28" r="8" className="structure-fill" />
          </g>

          {/* silo - positioned on horizon */}
          {/* silo: internal height ~48 scaled 0.5 -> 24 => translateY = 210 - 24 = 186 */}
          <g transform="translate(420,186) scale(0.5)">
            <rect x="0" y="0" width="18" height="48" rx="4" className="structure-fill" />
            <ellipse cx="9" cy="0" rx="9" ry="4" className="structure-fill" />
          </g>

          {/* windmill - near the right, sitting on sand horizon */}
          {/* windmill: rotor centered above pole */}
          <g transform="translate(520,180) scale(0.5)">
            {/* pole */}
            <rect x="8" y="6" width="4" height="48" rx="2" className="structure-fill" />
            {/* hub */}
            <circle cx="10" cy="0" r="4" className="structure-fill" />
            {/* blades (static) */}
            <g transform="translate(10,0)">
              <rect x="-1" y="-30" width="2" height="18" className="structure-fill" transform="rotate(0)" />
              <rect x="-1" y="-30" width="2" height="18" className="structure-fill" transform="rotate(90)" />
              <rect x="-1" y="-30" width="2" height="18" className="structure-fill" transform="rotate(45)" />
              <rect x="-1" y="-30" width="2" height="18" className="structure-fill" transform="rotate(-45)" />
            </g>
          </g>
        </g>

        {/* ants group - render all ants */}
        <g id="ants">
          {ants.map((ant) => (
            <Ant 
              key={ant.id}
              pathId="horizonPathMotion" 
              initialSpeed={ant.speed} 
              scale={0.655} 
              color={ant.color}
              onDig={handleDigStart} 
              resetSignal={resetSignal}
              onDigEnd={() => { handleDigEndFromAnt() }} 
              onUpdatePos={handleUpdatePos}
              getTunnelPoints={getTunnelPoints}
              onPickupGrain={handlePickupGrain}
              onDepositGrain={handleDepositGrain}
              getCarriedCount={getCarriedCount}
              forceEnterTunnel={forceEnterTunnel}
            />
          ))}
          {/* render carried grains attached to ant while digging */}
          {antPos && isDigging && carriedRef.current.length > 0 && (
            <g transform={`translate(${antPos.x - 6}, ${antPos.y - 6}) scale(0.6)`}>
              {carriedRef.current.slice(0, 8).map((g, i) => (
                <ellipse key={`carry-${i}`} cx={i * 3} cy={-6 - (i % 2) * 3} rx={g.r} ry={g.r * 0.6} fill="#caa97a" opacity={0.95} />
              ))}
            </g>
          )}
        </g>

        {/* render grains on sand surface */}
        <g id="grains">
          {grains.map((g, i) => (
            <ellipse key={i} cx={g.x} cy={g.y} rx={g.r} ry={g.r * 0.5} fill="#caa97a" opacity={0.95} />
          ))}
        </g>
        </g>
      </svg>
      </div>
    </div>
  )
}
