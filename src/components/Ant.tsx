import React, { useEffect, useRef, useState } from 'react'

type Props = {
  antId: number
  pathId: string
  initialSpeed?: number // px per second
  color?: string
  scale?: number
  isDead?: boolean
  onDig?: (pt: { x: number; y: number }, antId?: number) => void
  resetSignal?: number
  getSurfaceY?: (x: number) => number
  onUpdatePos?: (p: { x: number; y: number; angle: number; legSwing: number; mode?: string }) => void
  onDigEnd?: () => void
  getTunnelPoints?: (antIdOrSkip?: number | boolean, skipOvercrowdCheck?: boolean) => Array<{ x: number; y: number }>
  onPickupGrain?: (tunnelX: number, tunnelY: number, antId?: number) => void
  onDepositGrain?: (surfaceX: number, surfaceY: number) => void
  onAscendingWithGrain?: (tunnelX: number, tunnelY: number, antId?: number) => void  // Called when ant starts ascending with grain
  getCarriedCount?: () => number
  forceEnterTunnel?: number  // Increment to force ant to enter tunnel
  onLeaveTunnel?: () => void  // Called when ant leaves a tunnel
}

export default function Ant({ 
  antId,
  pathId, 
  initialSpeed = 10, 
  color = '#231f20', 
  scale = 0.8, 
  isDead = false,
  onDig, 
  resetSignal, 
  getSurfaceY, 
  onUpdatePos, 
  onDigEnd,
  getTunnelPoints,
  onPickupGrain,
  onDepositGrain,
  onAscendingWithGrain,
  getCarriedCount,
  forceEnterTunnel,
  onLeaveTunnel
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
  const onAscendingWithGrainRef = useRef(onAscendingWithGrain)
  const getCarriedCountRef = useRef(getCarriedCount)
  const onLeaveTunnelRef = useRef(onLeaveTunnel)
  const isDeadRef = useRef(isDead)
  
  useEffect(() => {
    getTunnelPointsRef.current = getTunnelPoints
    onPickupGrainRef.current = onPickupGrain
    onDepositGrainRef.current = onDepositGrain
    onAscendingWithGrainRef.current = onAscendingWithGrain
    getCarriedCountRef.current = getCarriedCount
    onLeaveTunnelRef.current = onLeaveTunnel
    isDeadRef.current = isDead
  })

  useEffect(() => {
    const path = document.getElementById(pathId) as SVGPathElement | null
    if (!path) return
    lengthRef.current = path.getTotalLength()

    // Decision making: check for tunnel opportunities periodically
    const checkForTunnel = () => {
      // Don't check for tunnels if dead
      if (isDeadRef.current) {
        setTimeout(checkForTunnel, 2000 + Math.random() * 3000)
        return
      }
      
      if (modeRef.current === 'surface' && !isDiggingRef.current && getTunnelPointsRef.current) {
        const tunnels = getTunnelPointsRef.current()
        try { console.debug('[Ant', antId, '] Checking tunnels:', tunnels ? tunnels.length : 0, 'points available, mode:', modeRef.current) } catch(e) {}
        if (tunnels && tunnels.length >= 2) {
          // Found a tunnel! Check if we're close to entry
          const surfacePt = path.getPointAtLength(curRef.current)
          const nearbyEntry = tunnels[0] // Use first point as entry
          const distance = Math.abs(nearbyEntry.x - surfacePt.x)
          try { console.debug('[Ant', antId, '] Distance to tunnel:', distance, 'px, entry at', nearbyEntry) } catch(e) {}
          if (distance < 50 && Math.random() < 0.5) {
            tunnelEntryRef.current = { x: nearbyEntry.x, y: nearbyEntry.y }
            tunnelPathRef.current = tunnels
            tunnelProgressRef.current = 0
            setMode('descending')
            movingRef.current = true
            try { console.debug('[Ant', antId, '] Starting tunnel descent with', tunnels.length, 'points!') } catch(e) {}
          }
        } else if (tunnels && tunnels.length === 0) {
          // No available tunnels (all overcrowded), continue walking and likely dig a new tunnel
          try { console.debug('[Ant', antId, '] No available tunnels (overcrowded), will continue walking') } catch(e) {}
        }
      }
      setTimeout(checkForTunnel, 2000 + Math.random() * 3000)
    }
    setTimeout(checkForTunnel, 3000)

    // Random surface behavior
    let stopped = false
    const scheduleRandom = () => {
      // Don't schedule actions if dead
      if (isDeadRef.current) {
        setTimeout(scheduleRandom, 1000)
        return
      }
      
      if (modeRef.current !== 'surface') {
        setTimeout(scheduleRandom, 1000)
        return
      }
      const r = Math.random()
      if (r < 0.18) {
        const pause = 800 + Math.random() * 1700
        stopped = true
        movingRef.current = false
        setTimeout(() => { if (!isDeadRef.current) { stopped = false; movingRef.current = true } }, pause)
      } else if (r < 0.28 && onDig) {
        // Start digging a NEW tunnel
        movingRef.current = false
        const pt = path.getPointAtLength(curRef.current)
        try { console.debug('[Ant', antId, '] start dig at', pt) } catch (e) {}

        // Function to poll for the tunnel this ant just started (skip overcrowd check)
        const checkTunnelReady = () => {
          console.log('[Ant', antId, '] checkTunnelReady called, modeRef:', modeRef.current)
          if (!getTunnelPointsRef.current) {
            console.log('[Ant', antId, '] No getTunnelPointsRef, retrying...')
            setTimeout(checkTunnelReady, 300)
            return
          }
          // Pass antId so getTunnelPoints returns the ant's assigned tunnel
          const tunnels = getTunnelPointsRef.current(antId)
          console.log('[Ant', antId, '] Got tunnels:', tunnels ? tunnels.length : 0, 'points')
          // Start descending immediately with even just 1 point - ant will dig as it goes
          if (tunnels && tunnels.length >= 1) {
            console.log('[Ant', antId, '] ENTERING TUNNEL NOW - setting mode to descending')
            tunnelEntryRef.current = { x: tunnels[0].x, y: tunnels[0].y }
            tunnelPathRef.current = tunnels
            tunnelProgressRef.current = 0
            modeRef.current = 'descending'  // Set ref directly first
            setMode('descending')           // Then update state
            if (!isDeadRef.current) movingRef.current = true
            console.log('[Ant', antId, '] Mode is now:', modeRef.current, 'tunnelPath has', tunnelPathRef.current.length, 'points')
          } else {
            // Tunnel not ready yet, check again
            console.log('[Ant', antId, '] Tunnel not ready, retrying in 300ms')
            setTimeout(checkTunnelReady, 300)
          }
        }

        // Ask AntFarm to start digging and associate tunnel with this ant
        const res = onDig({ x: pt.x, y: pt.y }, antId)
        setIsDigging(true)
        isDiggingRef.current = true
        // Start polling immediately so the ant can enter as soon as segments appear
        setTimeout(checkTunnelReady, 200)

        const digTime = 1200 + Math.random() * 1800
        setTimeout(() => {
          if (!isDeadRef.current) movingRef.current = true
          setIsDigging(false)
          isDiggingRef.current = false
          try { console.debug('[Ant', antId, '] end dig - will enter tunnel when ready') } catch (e) {}
          if (typeof onDigEnd === 'function') onDigEnd()
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

      // Don't move if dead
      if (isDeadRef.current) {
        return
      }

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
        
        // If descending, trigger tunnel extension FIRST so path grows ahead of ant
        if (isDescending && typeof (window as any).handleAntDiggingProgress === 'function') {
          (window as any).handleAntDiggingProgress(antId, tunnelProgressRef.current + 2)
          // Refresh our tunnel path from the source to get newly added points
          if (getTunnelPointsRef.current) {
            const updatedPath = getTunnelPointsRef.current(antId)
            if (updatedPath && updatedPath.length > tunnelPathRef.current.length) {
              tunnelPathRef.current = updatedPath
            }
          }
        }

        const pathLen = tunnelPathRef.current.length
        
        // If path is too short, don't move but keep animating
        if (pathLen < 2) {
          // Track how long we've been waiting
          const waitKey = `ant_${antId}_wait`
          const waitStart = (window as any)[waitKey] || now
          if (!(window as any)[waitKey]) (window as any)[waitKey] = now
          
          // If waiting too long (3 seconds), return to surface
          if (now - waitStart > 3000) {
            console.log('[Ant', antId, '] Stuck waiting for tunnel, returning to surface')
            delete (window as any)[waitKey]
            setMode('surface')
            movingRef.current = true
            tunnelPathRef.current = []
            if (onLeaveTunnelRef.current) onLeaveTunnelRef.current()
          }
          
          rafRef.current = requestAnimationFrame(step)
          return
        }
        
        // Clear wait timer since we have enough path
        delete (window as any)[`ant_${antId}_wait`]
        
        // Now safe to advance progress
        tunnelProgressRef.current += targetSpeed * dt * (isDescending ? 1 : -1)

        const maxProgress = pathLen - 1
        if (isDescending && tunnelProgressRef.current >= maxProgress) {
          // Reached deepest point - pick up grain (but don't extend tunnel yet)
          tunnelProgressRef.current = maxProgress
          const grainPt = tunnelPathRef.current[pathLen - 1]
          console.log('[Ant] Reached deepest point at', grainPt, 'tunnel length:', pathLen)
          
          // Check if we're in a large room (tunnel is long)
          const isInRoom = pathLen >= 15
          
          // Just pick up the grain without extending the tunnel
          if (onPickupGrainRef.current) {
            onPickupGrainRef.current(grainPt.x, grainPt.y, antId)
            setCarryingGrain(true)
          }
          setMode('at-grain')
          
          // If in a room, rest longer before ascending
          const restTime = isInRoom ? 1200 + Math.random() * 800 : 400
          if (isInRoom) {
            console.log('[Ant] Resting in room for', Math.round(restTime), 'ms')
          }
          
          setTimeout(() => {
            console.log('[Ant] Starting ascent - NOW extend tunnel')
            // Trigger tunnel extension when ant starts ascending with grain
            if (onAscendingWithGrainRef.current) {
              onAscendingWithGrainRef.current(grainPt.x, grainPt.y, antId)
            }
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

            // Check if there are more grains in THIS SAME tunnel (prevent teleportation)
            const moreGrains = getCarriedCountRef.current ? getCarriedCountRef.current() : 0
            if (moreGrains > 0 && tunnelPathRef.current.length >= 2) {
              // More grains available - stay at the same tunnel entry point
              try { console.debug('[Ant', antId, '] More grains available (', moreGrains, '), going back down the SAME tunnel') } catch(e) {}
              
              // Keep the same tunnel path and just reset progress to go back down
              // Don't fetch a new tunnel - this prevents teleportation
              tunnelProgressRef.current = 0
              setMode('descending')
              movingRef.current = true
            } else {
              // No more grains or tunnel no longer valid, return to surface walking
              try { console.debug('[Ant] No more grains or tunnel invalid, returning to surface walking') } catch(e) {}
              setMode('surface')
              movingRef.current = true
              tunnelPathRef.current = [] // Clear tunnel path
              // Notify parent that ant has left the tunnel
              if (onLeaveTunnelRef.current) {
                onLeaveTunnelRef.current()
              }
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
    if (isDeadRef.current) return
    if (typeof forceEnterTunnel === 'number' && forceEnterTunnel > 0) {
      console.log('[Ant', antId, '] forceEnterTunnel triggered:', forceEnterTunnel)
      if (getTunnelPointsRef.current) {
        const tunnels = getTunnelPointsRef.current()
        console.log('[Ant', antId, '] Force enter - got', tunnels ? tunnels.length : 0, 'tunnel points')
        if (tunnels && tunnels.length >= 2) {
          console.log('[Ant', antId, '] FORCE ENTERING TUNNEL')
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
  const legOffset = isDead ? 0 : legSwing * 2  // No leg animation when dead
  const deadScale = isDead ? 0.7 : 1  // Shrivel when dead
  const deadOpacity = isDead ? 0.5 : 1  // Fade when dead
  const deadColor = isDead ? '#4a4a4a' : color  // Gray when dead
  
  return (
    <g transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.angle}) scale(${scale * deadScale})`} style={{ pointerEvents: 'none' }} opacity={deadOpacity}>
      {/* body segments - more shriveled and curled when dead */}
      <ellipse cx="-6" cy={isDead ? "1" : "0"} rx={isDead ? "3" : "4"} ry={isDead ? "2" : "3"} fill={deadColor} />
      <ellipse cx="0" cy="0" rx={isDead ? "4" : "5"} ry={isDead ? "2.5" : "3.2"} fill={deadColor} />
      <ellipse cx="7" cy={isDead ? "-1" : "0"} rx={isDead ? "2.5" : "3.5"} ry={isDead ? "1.8" : "2.5"} fill={deadColor} />
      {/* head/antennae - droopy when dead */}
      <circle cx="11" cy="-1" r={isDead ? "1.2" : "1.6"} fill={deadColor} />
      {!isDead && (
        <>
          <line x1="11" y1="-1" x2="14" y2="-4" stroke={deadColor} strokeWidth={0.9} strokeLinecap="round" />
          <line x1="11" y1="-1" x2="14" y2="1" stroke={deadColor} strokeWidth={0.9} strokeLinecap="round" />
        </>
      )}
      {isDead && (
        <>
          <line x1="11" y1="-1" x2="13" y2="1" stroke={deadColor} strokeWidth={0.7} strokeLinecap="round" />
          <line x1="11" y1="-1" x2="12.5" y2="2" stroke={deadColor} strokeWidth={0.7} strokeLinecap="round" />
        </>
      )}

      {/* legs: three on each side, animated by legOffset (curled up when dead) */}
      <g stroke={deadColor} strokeWidth={isDead ? 0.7 : 0.9} strokeLinecap="round">
        {isDead ? (
          // Curled up legs when dead
          <>
            <line x1="-2" y1="-3" x2="-4" y2="-2" />
            <line x1="-2" y1="3" x2="-4" y2="2" />
            <line x1="2" y1="-3" x2="1" y2="-1" />
            <line x1="2" y1="3" x2="1" y2="1" />
            <line x1="6" y1="-2" x2="6" y2="0" />
            <line x1="6" y1="2" x2="6" y2="0" />
          </>
        ) : (
          // Animated legs when alive
          <>
            <line x1="-2" y1="-3" x2={`${-8 + legOffset}`} y2="-6" />
            <line x1="-2" y1="3" x2={`${-8 - legOffset}`} y2="6" />
            <line x1="2" y1="-3" x2={`${-1 + legOffset}`} y2="-6" />
            <line x1="2" y1="3" x2={`${-1 - legOffset}`} y2="6" />
            <line x1="6" y1="-2" x2={`${10 + legOffset}`} y2="-5" />
            <line x1="6" y1="2" x2={`${10 - legOffset}`} y2="5" />
          </>
        )}
      </g>
      
      {/* grain carried in mandibles when carryingGrain is true */}
      {carryingGrain && (
        <ellipse cx="12" cy="-0.5" rx="2" ry="1.2" fill="#caa97a" opacity={0.98} stroke="#b8945a" strokeWidth="0.3" />
      )}
    </g>
  )
}
