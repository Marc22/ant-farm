import React, { useEffect, useRef, useState } from 'react'

type Props = {
  pathId: string
  initialSpeed?: number // px per second
  color?: string
  scale?: number
  onDig?: (pt: { x: number; y: number }) => void
  resetSignal?: number
  getSurfaceY?: (x: number) => number
  onUpdatePos?: (p: { x: number; y: number; angle: number; legSwing: number; mode?: string }) => void
  onDigEnd?: () => void
  getTunnelPoints?: () => Array<{ x: number; y: number }>
  onPickupGrain?: (tunnelX: number, tunnelY: number) => void
  onDepositGrain?: (surfaceX: number, surfaceY: number) => void
  getCarriedCount?: () => number
  forceEnterTunnel?: number  // Increment to force ant to enter tunnel
}

export default function Ant({ 
  pathId, 
  initialSpeed = 10, 
  color = '#231f20', 
  scale = 0.8, 
  onDig, 
  resetSignal, 
  getSurfaceY, 
  onUpdatePos, 
  onDigEnd,
  getTunnelPoints,
  onPickupGrain,
  onDepositGrain,
  getCarriedCount,
  forceEnterTunnel
}: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0, angle: 0, legSwing: 0 })
  const [isDigging, setIsDigging] = useState(false)
  const [carryingGrain, setCarryingGrain] = useState(false)
  const isDiggingRef = useRef(false)
  const movingRef = useRef(true)
  const dirRef = useRef(1)
  const speedRef = useRef(initialSpeed)
  const lengthRef = useRef(0)
  const curRef = useRef(Math.random() * 100) // Start at random position along path
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)
  const diveOffsetRef = useRef(0)
  
  // Tunnel navigation state
  type AntMode = 'surface' | 'descending' | 'at-grain' | 'ascending' | 'depositing'
  const [mode, setModeState] = useState<AntMode>('surface')
  const modeRef = useRef<AntMode>('surface')
  const setMode = (m: AntMode) => {
    modeRef.current = m
    setModeState(m)
  }
  const tunnelPathRef = useRef<Array<{ x: number; y: number }>>([])
  const tunnelProgressRef = useRef(0)
  const tunnelEntryRef = useRef<{ x: number; y: number } | null>(null)
  
  // Use refs to always get the latest callbacks
  const getTunnelPointsRef = useRef(getTunnelPoints)
  const onPickupGrainRef = useRef(onPickupGrain)
  const onDepositGrainRef = useRef(onDepositGrain)
  const getCarriedCountRef = useRef(getCarriedCount)
  
  useEffect(() => {
    getTunnelPointsRef.current = getTunnelPoints
    onPickupGrainRef.current = onPickupGrain
    onDepositGrainRef.current = onDepositGrain
    getCarriedCountRef.current = getCarriedCount
  })

  useEffect(() => {
    const path = document.getElementById(pathId) as SVGPathElement | null
    if (!path) return
    lengthRef.current = path.getTotalLength()

    // Decision making: check for tunnel opportunities periodically
    const checkForTunnel = () => {
      if (modeRef.current === 'surface' && !isDiggingRef.current && getTunnelPointsRef.current) {
        const tunnels = getTunnelPointsRef.current()
        try { console.debug('[Ant] Checking tunnels:', tunnels ? tunnels.length : 0, 'points available, mode:', modeRef.current) } catch(e) {}
        if (tunnels && tunnels.length >= 2) {
          // Found a tunnel! Check if we're close to entry
          const surfacePt = path.getPointAtLength(curRef.current)
          const nearbyEntry = tunnels[0] // Use first point as entry
          const distance = Math.abs(nearbyEntry.x - surfacePt.x)
          try { console.debug('[Ant] Distance to tunnel:', distance, 'px, entry at', nearbyEntry) } catch(e) {}
          if (distance < 50 && Math.random() < 0.5) {
            tunnelEntryRef.current = { x: nearbyEntry.x, y: nearbyEntry.y }
            tunnelPathRef.current = tunnels
            tunnelProgressRef.current = 0
            setMode('descending')
            movingRef.current = true
            try { console.debug('[Ant] Starting tunnel descent with', tunnels.length, 'points!') } catch(e) {}
          }
        }
      }
      setTimeout(checkForTunnel, 2000 + Math.random() * 3000)
    }
    setTimeout(checkForTunnel, 3000)

    // Random surface behavior
    let stopped = false
    const scheduleRandom = () => {
      if (modeRef.current !== 'surface') {
        setTimeout(scheduleRandom, 1000)
        return
      }
      const r = Math.random()
      if (r < 0.18) {
        const pause = 800 + Math.random() * 1700
        stopped = true
        movingRef.current = false
        setTimeout(() => { stopped = false; movingRef.current = true }, pause)
      } else if (r < 0.28 && onDig) {
        // Start digging a NEW tunnel
        movingRef.current = false
        const pt = path.getPointAtLength(curRef.current)
        try { console.debug('[Ant] start dig at', pt) } catch (e) {}
        onDig({ x: pt.x, y: pt.y })
        setIsDigging(true)
        isDiggingRef.current = true
        const digTime = 1200 + Math.random() * 1800
        setTimeout(() => {
          movingRef.current = true
          setIsDigging(false)
          isDiggingRef.current = false
          try { console.debug('[Ant] end dig - will enter tunnel when ready') } catch (e) {}
          if (typeof onDigEnd === 'function') onDigEnd()

          // Wait for tunnel to be complete before entering
          const checkTunnelReady = () => {
            console.log('[Ant] checkTunnelReady called, modeRef:', modeRef.current)
            if (!getTunnelPointsRef.current) {
              console.log('[Ant] No getTunnelPointsRef, retrying...')
              setTimeout(checkTunnelReady, 300)
              return
            }
            const tunnels = getTunnelPointsRef.current()
            console.log('[Ant] Got tunnels:', tunnels ? tunnels.length : 0, 'points')
            if (tunnels && tunnels.length >= 2) {
              console.log('[Ant] ENTERING TUNNEL NOW - setting mode to descending')
              tunnelEntryRef.current = { x: tunnels[0].x, y: tunnels[0].y }
              tunnelPathRef.current = tunnels
              tunnelProgressRef.current = 0
              modeRef.current = 'descending'  // Set ref directly first
              setMode('descending')           // Then update state
              movingRef.current = true
              console.log('[Ant] Mode is now:', modeRef.current, 'tunnelPath has', tunnelPathRef.current.length, 'points')
            } else {
              // Tunnel not ready yet, check again
              console.log('[Ant] Tunnel not ready, retrying in 300ms')
              setTimeout(checkTunnelReady, 300)
            }
          }
          // Start checking after a brief delay
          setTimeout(checkTunnelReady, 500)
        }, digTime)
      }
      if (Math.random() < 0.25) dirRef.current *= -1
      speedRef.current = Math.max(6, initialSpeed * (0.7 + Math.random() * 1.1))
      setTimeout(scheduleRandom, 1500 + Math.random() * 3500)
    }
    scheduleRandom()

    const step = (now: number) => {
      if (lastRef.current == null) lastRef.current = now
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now

      // Debug: log mode every 60 frames
      if (typeof window !== 'undefined') {
        (window as any).frameCount = ((window as any).frameCount || 0) + 1
        if ((window as any).frameCount % 120 === 0) {
          console.log('[Ant step] mode:', modeRef.current, 'tunnelPath:', tunnelPathRef.current.length, 'progress:', tunnelProgressRef.current.toFixed(2))
        }
      }

      if (modeRef.current === 'surface') {
        // Normal surface walking
        if (movingRef.current) {
          curRef.current += dirRef.current * speedRef.current * dt
          if (curRef.current < 0) { curRef.current = 0; dirRef.current = 1 }
          if (curRef.current > lengthRef.current) { curRef.current = lengthRef.current; dirRef.current = -1 }
          const p = path.getPointAtLength(curRef.current)
          const ahead = Math.min(lengthRef.current, curRef.current + (dirRef.current * 2))
          const p2 = path.getPointAtLength(Math.max(0, ahead))
          const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI
          const surfaceY = getSurfaceY ? getSurfaceY(p.x) : p.y
          const swing = Math.sin(now / 160 * (speedRef.current / 8)) * 1.0
          const targetDive = isDiggingRef.current ? 10 : 0
          diveOffsetRef.current = diveOffsetRef.current * 0.82 + targetDive * 0.18
          const yWithDive = surfaceY + diveOffsetRef.current
          setPos({ x: p.x, y: yWithDive, angle, legSwing: swing })
          if (typeof onUpdatePos === 'function') onUpdatePos({ x: p.x, y: yWithDive, angle, legSwing: swing, mode: 'surface' })
        }
      } else if (modeRef.current === 'descending' || modeRef.current === 'ascending') {
        // Navigate along tunnel path
        const isDescending = modeRef.current === 'descending'
        const targetSpeed = initialSpeed * 0.6 // Slower in tunnel
        tunnelProgressRef.current += targetSpeed * dt * (isDescending ? 1 : -1)

        const pathLen = tunnelPathRef.current.length
        if (pathLen < 2) {
          try { console.debug('[Ant] Tunnel path too short, returning to surface') } catch(e) {}
          setMode('surface')
          return
        }

        const maxProgress = pathLen - 1
        if (isDescending && tunnelProgressRef.current >= maxProgress) {
          // Reached deepest point - pick up grain
          tunnelProgressRef.current = maxProgress
          const grainPt = tunnelPathRef.current[pathLen - 1]
          console.log('[Ant] Reached deepest point at', grainPt, 'tunnel length:', pathLen)
          
          // Check if we're in a large room (tunnel is long)
          const isInRoom = pathLen >= 15
          
          if (onPickupGrainRef.current) {
            onPickupGrainRef.current(grainPt.x, grainPt.y)
            setCarryingGrain(true)
          }
          setMode('at-grain')
          
          // If in a room, rest longer before ascending
          const restTime = isInRoom ? 1200 + Math.random() * 800 : 400
          if (isInRoom) {
            console.log('[Ant] Resting in room for', Math.round(restTime), 'ms')
          }
          
          setTimeout(() => {
            console.log('[Ant] Starting ascent')
            setMode('ascending')
          }, restTime)
        } else if (!isDescending && tunnelProgressRef.current <= 0) {
          // Back at surface - deposit
          tunnelProgressRef.current = 0
          setMode('depositing')
          const surfacePt = tunnelPathRef.current[0]
          try { console.debug('[Ant] Back at surface, depositing') } catch(e) {}
          setTimeout(() => {
            if (onDepositGrainRef.current) {
              onDepositGrainRef.current(surfacePt.x, surfacePt.y)
              setCarryingGrain(false)
            }
            try { console.debug('[Ant] Deposited grain, checking if more grains in tunnel') } catch(e) {}

            // Check if there are more grains in this tunnel
            const moreGrains = getCarriedCountRef.current ? getCarriedCountRef.current() : 0
            if (moreGrains > 0 && tunnelPathRef.current.length >= 2) {
              // More grains available - go back down immediately!
              try { console.debug('[Ant] More grains available (', moreGrains, '), going back down!') } catch(e) {}
              
              // Re-fetch the tunnel path in case it was extended
              if (getTunnelPointsRef.current) {
                const latestPath = getTunnelPointsRef.current()
                if (latestPath && latestPath.length >= 2) {
                  tunnelPathRef.current = latestPath
                }
              }
              
              tunnelProgressRef.current = 0
              setMode('descending')
              movingRef.current = true
            } else {
              // No more grains, return to surface walking
              try { console.debug('[Ant] No more grains, returning to surface walking') } catch(e) {}
              setMode('surface')
              movingRef.current = true
              tunnelPathRef.current = [] // Clear tunnel path
            }
          }, 300)
        }

        // Interpolate position along tunnel
        const idx = Math.floor(tunnelProgressRef.current)
        const frac = tunnelProgressRef.current - idx
        const p1 = tunnelPathRef.current[Math.max(0, Math.min(idx, pathLen - 1))]
        const p2 = tunnelPathRef.current[Math.max(0, Math.min(idx + 1, pathLen - 1))]
        const x = p1.x + (p2.x - p1.x) * frac
        const y = p1.y + (p2.y - p1.y) * frac
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI * (isDescending ? 1 : -1)
        const swing = Math.sin(now / 160 * (targetSpeed / 8)) * 1.0
        setPos({ x, y, angle, legSwing: swing })
        if (typeof onUpdatePos === 'function') onUpdatePos({ x, y, angle, legSwing: swing, mode: modeRef.current })
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [pathId, initialSpeed])

  // respond to resetSignal: reset position
  useEffect(() => {
    if (typeof resetSignal === 'number') {
      curRef.current = 0
      dirRef.current = 1
      movingRef.current = true
      lastRef.current = null
      setMode('surface')
      setCarryingGrain(false)
      setPos({ x: 0, y: 0, angle: 0, legSwing: 0 })
    }
  }, [resetSignal])

  // respond to forceEnterTunnel: immediately enter tunnel if available
  useEffect(() => {
    if (typeof forceEnterTunnel === 'number' && forceEnterTunnel > 0) {
      console.log('[Ant] forceEnterTunnel triggered:', forceEnterTunnel)
      if (getTunnelPointsRef.current) {
        const tunnels = getTunnelPointsRef.current()
        console.log('[Ant] Force enter - got', tunnels ? tunnels.length : 0, 'tunnel points')
        if (tunnels && tunnels.length >= 2) {
          console.log('[Ant] FORCE ENTERING TUNNEL')
          tunnelEntryRef.current = { x: tunnels[0].x, y: tunnels[0].y }
          tunnelPathRef.current = tunnels
          tunnelProgressRef.current = 0
          modeRef.current = 'descending'
          setMode('descending')
          movingRef.current = true
        }
      }
    }
  }, [forceEnterTunnel])

  // Render a more side-view ant: three body segments and animated legs
  const { legSwing } = pos
  const legOffset = legSwing * 2
  return (
    <g transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.angle}) scale(${scale})`} style={{ pointerEvents: 'none' }}>
      {/* body segments */}
      <ellipse cx="-6" cy="0" rx="4" ry="3" fill={color} />
      <ellipse cx="0" cy="0" rx="5" ry="3.2" fill={color} />
      <ellipse cx="7" cy="0" rx="3.5" ry="2.5" fill={color} />
      {/* head/antennae */}
      <circle cx="11" cy="-1" r="1.6" fill={color} />
      <line x1="11" y1="-1" x2="14" y2="-4" stroke={color} strokeWidth={0.9} strokeLinecap="round" />
      <line x1="11" y1="-1" x2="14" y2="1" stroke={color} strokeWidth={0.9} strokeLinecap="round" />

      {/* legs: three on each side, animated by legOffset */}
      <g stroke={color} strokeWidth={0.9} strokeLinecap="round">
        <line x1="-2" y1="-3" x2={`${-8 + legOffset}`} y2="-6" />
        <line x1="-2" y1="3" x2={`${-8 - legOffset}`} y2="6" />

        <line x1="2" y1="-3" x2={`${-1 + legOffset}`} y2="-6" />
        <line x1="2" y1="3" x2={`${-1 - legOffset}`} y2="6" />

        <line x1="6" y1="-2" x2={`${10 + legOffset}`} y2="-5" />
        <line x1="6" y1="2" x2={`${10 - legOffset}`} y2="5" />
      </g>
      
      {/* grain carried in mandibles when carryingGrain is true */}
      {carryingGrain && (
        <ellipse cx="12" cy="-0.5" rx="2" ry="1.2" fill="#caa97a" opacity={0.98} stroke="#b8945a" strokeWidth="0.3" />
      )}
    </g>
  )
}
