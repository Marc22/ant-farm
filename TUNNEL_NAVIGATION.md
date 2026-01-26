# Tunnel Navigation Feature - January 25, 2026

## Overview

Implemented realistic ant behavior where ants physically crawl down into tunnels, pick up individual grains of sand one at a time, and carry them back up to the surface.

## Ant State Machine

The ant now operates in 5 distinct modes:

### 1. **Surface Mode** (default)

- Ant walks along the horizon path
- Random pauses, direction changes, speed variations
- Can trigger new tunnel digging
- Periodically checks for existing tunnels to explore

### 2. **Descending Mode**

- Ant enters a tunnel and crawls downward
- Follows tunnel path points (holes) sequentially
- Moves 60% slower than surface speed
- Body angle adjusts to follow tunnel direction
- Continues until reaching deepest point

### 3. **At-Grain Mode** (brief pause)

- Ant reaches the deepest tunnel point
- Picks up one grain of sand (adds to carried buffer)
- Brief 400ms pause at grain location
- Automatically transitions to ascending

### 4. **Ascending Mode**

- Ant crawls back up through the same tunnel path
- Carries visible grain in mandibles
- Body angle reverses (facing upward)
- Same speed as descending
- Returns to surface entry point

### 5. **Depositing Mode** (brief)

- Ant reaches surface with grain
- 300ms pause to deposit
- Grain launches with arc physics
- Returns to surface walking mode

## Technical Implementation

### Ant Component Changes (`Ant.tsx`)

#### New Props

```typescript
getTunnelPoints?: () => Array<{ x: number; y: number }>  // Get tunnel hole coordinates
onPickupGrain?: (tunnelX: number, tunnelY: number) => void  // Notify grain pickup
onDepositGrain?: (surfaceX: number, surfaceY: number) => void  // Notify grain deposit
getCarriedCount?: () => number  // Query how many grains in buffer
```

#### New State

```typescript
const [mode, setMode] = useState<AntMode>("surface"); // Current behavior mode
const [carryingGrain, setCarryingGrain] = useState(false); // Visual grain indicator
const tunnelPathRef = useRef<Array<{ x: number; y: number }>>([]); // Current tunnel
const tunnelProgressRef = useRef(0); // Position along tunnel (0 = surface, max = deepest)
```

#### State Machine Logic

- **Tunnel Detection**: Every 2-5 seconds, checks `getTunnelPoints()` for available tunnels
- **Entry Condition**: If within 50px of tunnel entrance and random chance (30%), starts descent
- **Path Following**: Interpolates position between tunnel points using linear interpolation
- **Progress Tracking**: `tunnelProgressRef` advances forward while descending, backward while ascending
- **Mode Transitions**: Automatic transitions at tunnel boundaries (deepest point, surface return)

### AntFarm Component Changes (`AntFarm.tsx`)

#### New Callbacks

```typescript
function getTunnelPoints(): Array<{ x: number; y: number }>;
// Returns up to 8 tunnel hole coordinates for ant navigation

function handlePickupGrain(tunnelX: number, tunnelY: number);
// Adds a new grain to carriedRef buffer when ant picks up

function handleDepositGrain(surfaceX: number, surfaceY: number);
// Pops grain from buffer and creates falling grain with arc physics

function getCarriedCount(): number;
// Returns current buffer size
```

## Visual Feedback

### Grain in Mandibles

When `carryingGrain === true`, ant renders a small sand-colored ellipse at the front:

```tsx
<ellipse cx="13" cy="0" rx="2.5" ry="1.5" fill="#caa97a" opacity={0.95} />
```

### Body Orientation

- **Surface/Descending**: Ant faces direction of movement
- **Ascending**: Angle inverted to show ant facing upward while backing out
- **Tunnel Speed**: 60% of surface speed for realistic underground movement

## Physics & Timing

| Action                | Duration       | Details                                |
| --------------------- | -------------- | -------------------------------------- |
| Tunnel check interval | 2-5 seconds    | Random checks for available tunnels    |
| At-grain pause        | 400ms          | Brief pause when picking up grain      |
| Deposit pause         | 300ms          | Brief pause when depositing at surface |
| Tunnel speed          | 60% of surface | Slower movement underground            |
| Entry proximity       | 50px           | Maximum distance to enter tunnel       |
| Entry probability     | 30%            | Chance to enter when near tunnel       |

## Grain Deposit Arc Physics

When ant deposits a grain at the surface:

```typescript
{
  x: surfaceX + random(-4, 4),
  y: surfaceY - 2,
  yv: -60 to -90,  // Upward launch velocity
  vx: random(-20, 20),  // Horizontal spread
  settled: false
}
```

## Integration with Existing Systems

### Compatible with Digging

- Ants can still dig NEW tunnels (creates holes, adds grains to buffer)
- After digging, ant continues surface behavior
- Existing tunnels become available for navigation by all ants

### Grain Buffer Management

- **During Digging**: Buffer fills with many grains instantly (old behavior)
- **During Tunnel Navigation**: Buffer grows one grain at a time (new behavior)
- **Both modes** deposit grains with arc physics

### Debug HUD Updates

The HUD continues to show:

- Ant position (updates as ant moves through tunnels)
- Digging status (separate from tunnel navigation)
- Carried grain count (increments/decrements one at a time during navigation)
- Settled grains (final pile statistics)

## Testing the Feature

1. **Start dev server**: `npm run dev`

2. **Trigger tunnel creation**:
   - Click "Force Dig" to make ant dig a tunnel
   - Wait for tunnel to complete (holes appear in sand)

3. **Watch for tunnel navigation**:
   - Ant will detect tunnel within 2-5 seconds
   - If within 50px and random check passes (30%), ant enters
   - Console logs: `[Ant] Starting tunnel descent`

4. **Observe behavior**:
   - Ant crawls down into tunnel (body follows path)
   - Pauses briefly at deepest point
   - Grain appears in mandibles (small ellipse at front)
   - Ant crawls back up (body rotates for ascent)
   - Grain launches in arc when ant reaches surface
   - Grain settles into pile using heightmap physics

5. **Verify HUD**:
   - "Carried" count increments by 1 during ascent
   - Decrements by 1 after deposit
   - Ant position shows tunnel coordinates during navigation

## Build Status

✅ Production build successful

- Bundle size: 142.15 KiB / 46.29 KiB gzipped
- No TypeScript errors
- All state transitions functional
- Grain pickup/deposit working
