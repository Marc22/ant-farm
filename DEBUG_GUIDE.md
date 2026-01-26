# Debugging Guide - Ant Tunnel Navigation

## How to Debug the Ant Behavior

### Step 1: Start Dev Server

```powershell
npm run dev
```

### Step 2: Open Browser Console

- Press F12 to open DevTools
- Click "Console" tab
- Clear console (click trash icon)

### Step 3: Trigger Digging

Click the **"Force Dig"** button

### Step 4: Watch Console Logs

You should see this sequence:

```
[AntFarm] digStart {x: 300, y: 210}
[AntFarm] handleDig called {x: 300, y: 210}
[AntFarm] Tunnel will be complete at 2026-01-25T...
[Ant] start dig at {x: 300, y: 210}
```

Then after ~1-3 seconds:

```
[Ant] end dig - will enter tunnel when ready
[AntFarm] digEndFromAnt - tunnel created, ant should now enter it
[Ant] Checking if tunnel ready: X points
```

If tunnel NOT ready:

```
[Ant] Tunnel not ready, checking again in 300ms
[Ant] Checking if tunnel ready: X points
```

When tunnel IS ready:

```
[AntFarm] Created tunnel 0 with 9 points at 2026-01-25T...
[AntFarm] Added 18 grains to tunnel 0
[Ant] Entering freshly dug tunnel with 9 points at 2026-01-25T...
```

Then you should see in HUD:

```
Mode: descending
Active: In Tunnel
```

And every second or so:

```
[Ant RAF] mode: descending tunnelPath length: 9 progress: 0.5
[Ant RAF] mode: descending tunnelPath length: 9 progress: 1.2
[Ant RAF] mode: descending tunnelPath length: 9 progress: 2.0
```

When ant reaches bottom:

```
[Ant] Reached deepest point at {x: ..., y: ...}
[AntFarm] Ant picking up grain near X, Y
[AntFarm] Picked up grain! Remaining in tunnels: 17
[Ant] Starting ascent
```

Then:

```
[Ant RAF] mode: ascending tunnelPath length: 9 progress: 1.8
[Ant RAF] mode: ascending tunnelPath length: 9 progress: 0.9
[Ant RAF] mode: ascending tunnelPath length: 9 progress: 0.1
```

When ant reaches surface:

```
[Ant] Back at surface, depositing
[AntFarm] Ant depositing grain at surface X, Y
[Ant] Deposited grain, back to surface
```

## What to Check

### Issue 1: Ant Not Entering Tunnel

**If you see:**

```
[Ant] Tunnel not ready, checking again in 300ms
[Ant] Tunnel not ready, checking again in 300ms
... (repeating forever)
```

**Problem**: Tunnel path never completes.

**Check**:

- Does "[AntFarm] Created tunnel X with Y points" appear?
- Is Y >= 2?

**If tunnel never creates**, check HUD "Tunnels: X paths"

- Should increment after digging

### Issue 2: Ant Enters But Doesn't Move

**If you see:**

```
[Ant] Entering freshly dug tunnel with 9 points
Mode: descending
```

**But NO "[Ant RAF]" logs**, the animation loop isn't running.

**Check**:

- Is the ant component mounted? (should see initial logs)
- Any errors in console?

### Issue 3: Ant Mode Stuck

**If HUD shows**: Mode: descending (forever)

**But console shows**: `[Ant RAF] mode: surface`

**Problem**: State desync between Ant component and AntFarm HUD.

### Issue 4: No Grain Pickup

**If ant descends but doesn't pick up grain:**

**Check console for:**

```
[AntFarm] Ant picking up grain near X, Y
[AntFarm] No grain found near X, Y - total grains: 0
```

**Problem**: tunnelGrains array is empty.

**Verify**: HUD shows "In Tunnels: X grains" where X > 0

## Manual Tests

### Test 1: Check Tunnels Button

Click "Check Tunnels" button

- Should show alert with tunnel point count
- Console shows array of {x, y} coordinates

### Test 2: Multiple Digs

1. Click "Force Dig"
2. Wait for ant to finish cycle
3. Click "Force Dig" again
4. Check HUD "Tunnels: X paths" increments

### Test 3: Watch Ant Position

Watch HUD "Ant: (X, Y)"

- X should stay relatively constant during tunnel navigation
- Y should INCREASE when descending (moving down into sand)
- Y > 210 means ant is below surface!

## Expected Y Values

- Surface: Y ≈ 210
- Shallow tunnel: Y ≈ 220-240
- Mid tunnel: Y ≈ 250-280
- Deep tunnel: Y ≈ 290-350

**If Y never goes above 210, ant is NOT entering tunnel!**

## Common Issues

### Tunnels Created But Ant Ignores Them

Check: Does `[Ant] Checking if tunnel ready` appear?

- If NO: onDigEnd callback not firing
- If YES but fails: getTunnelPoints() returning empty

### Ant Walks Through Tunnel Holes

Check: Is mode actually changing?

- Console: `[Ant RAF] mode: descending`
- HUD: Mode: descending

If both show descending but ant not moving down:

- Tunnel path interpolation broken
- Check tunnelProgressRef updates

## Success Indicators

✅ Console shows complete log sequence
✅ HUD Mode changes: surface → descending → ascending → surface
✅ HUD Y coordinate goes above 210
✅ "In Tunnels" count decreases
✅ "Carried" alternates 0 → 1 → 0
✅ "Settled" count increases
✅ Visible grain in ant mandibles during ascent
✅ Grain arcs from surface position
✅ Pile grows

## Quick Diagnosis

Run this in browser console after clicking Force Dig:

```javascript
// Wait 3 seconds after Force Dig, then run:
setTimeout(() => {
  console.log("Tunnel check:", {
    tunnelPaths: window.antFarmDebug?.tunnelPaths?.length || "N/A",
    tunnelGrains: window.antFarmDebug?.tunnelGrains?.length || "N/A",
    antMode: window.antFarmDebug?.antMode || "N/A",
  });
}, 3000);
```

**Share the console output** with me and I can diagnose the exact issue!
