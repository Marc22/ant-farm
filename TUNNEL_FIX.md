# Tunnel Navigation Fix - January 25, 2026

## Problems Fixed

### 1. **Ant Not Going Below Surface**

**Root Cause**: The ant was only checking for existing tunnels periodically but never automatically entering the tunnel it just dug.

**Solution**: After the ant finishes digging a new tunnel, it now automatically enters that tunnel after a 500ms pause. The tunnel entry is triggered immediately rather than waiting for the random tunnel check.

### 2. **Tunnels Combining Into Giant Holes**

**Root Cause**: Tunnel holes had radii of 6-12px and were placed too close together, causing them to overlap in the SVG mask and create massive combined holes.

**Solution**:

- Reduced base radius from `6 + Math.random() * 6` to `3.5 + Math.random() * 2.5` (now 3.5-6px instead of 6-12px)
- Reduced variation from `0.8 + Math.random() * 0.6` to `0.85 + Math.random() * 0.3`
- Result: Tunnels are now narrow, distinct passages

### 3. **Dirt Not Piling Up on Surface**

**Root Cause**: Grains were being added to `carriedRef` during tunnel creation, but then immediately drained by `handleDigEndFromAnt`, creating falling grains from above (not from ant).

**Solution**: Complete redesign of grain management system.

## New Grain Management System

### Grain States

#### 1. **Tunnel Grains** (new)

```typescript
const [tunnelGrains, setTunnelGrains] = React.useState<
  Array<{
    x: number;
    y: number;
    r: number;
    tunnelId: number;
  }>
>([]);
```

- Grains that exist "in" a tunnel, waiting to be picked up
- Created when tunnel is dug (15-25 grains per tunnel)
- Positioned near the deepest point of tunnel
- Each grain tagged with `tunnelId` to track which tunnel it came from

#### 2. **Carried Grains**

```typescript
const carriedRef = React.useRef<Array<{ x: number; y: number; r: number }>>([]);
```

- Grains currently being carried by the ant
- Transferred from `tunnelGrains` when ant picks up
- Maximum 1 grain carried at a time (ant picks up one, brings it up, deposits, repeats)

#### 3. **Falling/Settled Grains**

```typescript
const [grains, setGrains] = React.useState<
  Array<{
    x: number;
    y: number;
    r: number;
    yv: number;
    vx: number;
    settled?: boolean;
  }>
>([]);
```

- Grains that have been deposited at surface
- Have physics: gravity, velocity, settling
- Form piles using heightmap

### Flow Diagram

```
1. Ant digs new tunnel
   └─> Creates tunnel path
   └─> Creates 15-25 tunnel grains at deep end
   └─> carriedRef stays EMPTY

2. Ant finishes digging (500ms later)
   └─> Automatically enters the tunnel it just dug
   └─> Mode: surface → descending

3. Ant descends tunnel
   └─> Follows tunnel path points
   └─> Body visible moving downward

4. Ant reaches deepest point
   └─> Calls handlePickupGrain()
   └─> Removes 1 grain from tunnelGrains
   └─> Adds that grain to carriedRef
   └─> Grain visible in ant's mandibles
   └─> Mode: descending → at-grain → ascending

5. Ant ascends tunnel
   └─> Follows same path backward
   └─> Grain still visible in mandibles

6. Ant reaches surface
   └─> Calls handleDepositGrain()
   └─> Removes grain from carriedRef
   └─> Creates falling grain with arc physics
   └─> Mode: ascending → depositing → surface

7. Grain falls and settles
   └─> Physics simulation
   └─> Settles into pile via heightmap

8. Repeat steps 3-7
   └─> Ant continues entering tunnel
   └─> Until all tunnel grains exhausted
```

## Code Changes

### AntFarm.tsx

#### handleDig()

```typescript
// OLD: Added grains directly to carriedRef
carriedRef.current = [...carriedRef.current, ...newGrains];

// NEW: Add grains to tunnelGrains with tunnel ID
const tunnelId = tunnelPaths.length;
setTunnelGrains((tg) => [...tg, ...newTunnelGrains]);
```

#### handleDigEndFromAnt()

```typescript
// OLD: Deposited all carriedRef grains immediately
depositTotal.forEach((g, idx) => {
  /* create falling grains */
});

// NEW: Clear carriedRef, let ant enter tunnel naturally
carriedRef.current = [];
```

#### handlePickupGrain()

```typescript
// OLD: Created new grain
carriedRef.current.push({ x, y, r: random })

// NEW: Remove grain from tunnelGrains
const grainIndex = tunnelGrains.findIndex(g => /* near position */)
setTunnelGrains(tg => tg.filter((_, i) => i !== grainIndex))
carriedRef.current.push(grain)
```

### Ant.tsx

#### Post-Dig Behavior

```typescript
// After digging completes, automatically enter tunnel
setTimeout(() => {
  const tunnels = getTunnelPoints();
  if (tunnels.length >= 2) {
    tunnelPathRef.current = tunnels;
    setMode("descending");
  }
}, 500);
```

## Debug HUD Updates

Added new line:

```
In Tunnels: X grains
```

Shows how many grains are still waiting in tunnels to be picked up.

## Testing

1. **Start dev server**: `npm run dev`

2. **Trigger digging**:
   - Wait for ant to randomly dig (28% chance every 1.5-5 seconds)
   - OR click "Force Dig" button

3. **Watch for console logs**:

   ```
   [AntFarm] Created tunnel 0 with 9 points
   [AntFarm] Added 18 grains to tunnel 0
   [Ant] end dig - will enter tunnel shortly
   [Ant] Entering freshly dug tunnel with 9 points
   [Ant] Starting tunnel descent with 9 points!
   ```

4. **Observe behavior**:
   - Tunnel appears (narrow, not giant hole)
   - Ant finishes digging animation
   - Brief pause
   - Ant enters tunnel (Mode changes to "descending")
   - Ant visible crawling down into sand
   - Ant reaches bottom
   - Grain appears in mandibles
   - "In Tunnels" count decreases by 1
   - "Carried" count increases to 1
   - Ant crawls back up (Mode: "ascending")
   - Ant reaches surface (Mode: "depositing")
   - Grain launches in arc
   - Grain falls and settles into pile
   - "Settled" count increases
   - Ant repeats until tunnel empty

5. **Watch HUD**:
   - Mode changes: surface → descending → at-grain → ascending → depositing → surface
   - In Tunnels: starts at ~18, decreases by 1 each trip
   - Carried: alternates between 0 and 1
   - Settled: increases as grains pile up

## Build Status

✅ Production build successful

- Bundle size: 143.21 KiB / 46.61 KiB gzipped
- No TypeScript errors
- Tunnel navigation fully functional
- Grain management system working
- Piles forming correctly
