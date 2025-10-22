# Web Remote Desktop Application - Design Guidelines

## Design Approach

**System Selected:** Fluent Design System (Microsoft)
**Rationale:** Fluent excels at productivity applications requiring clear information hierarchy, system status display, and minimal visual interference with core functionality. Perfect for remote desktop interfaces where the screen content is primary.

**Key Design Principles:**
- Clarity over decoration - nothing should distract from the remote screen
- Instant status recognition through color and iconography
- Efficient control access without cluttering the viewport
- Professional, trustworthy aesthetic for enterprise/technical users

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 20% 12% (deep charcoal)
- Surface: 220 18% 18% (elevated panels)
- Border: 220 15% 25% (subtle separation)
- Primary: 210 100% 55% (trust blue)
- Success: 142 76% 45% (connected green)
- Warning: 38 92% 50% (standby amber)
- Error: 0 84% 60% (disconnected red)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 15% 88%
- Primary: 210 100% 45%
- (Status colors remain consistent)

### B. Typography

**Font Families:**
- Interface: 'Inter' (Google Fonts) - clean, technical readability
- Monospace: 'JetBrains Mono' - for session IDs, metrics

**Type Scale:**
- Display (Session Headers): 600 weight, 28px
- Body (Controls, Labels): 400 weight, 14px
- Caption (Status, Metrics): 400 weight, 12px
- Code (Session IDs): 400 weight, 13px monospace

### C. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: space-y-4, gap-6
- Tight groupings: space-y-2

**Grid Structure:**
- Control panels: Fixed sidebar (w-80) or floating overlay
- Main viewport: flex-1 with aspect-ratio preservation
- Metrics bar: Fixed bottom (h-12)

### D. Component Library

**Connection Panel:**
- Prominent session ID display with copy button
- Connection status badge (pill shape, pulsing dot for active)
- Role indicator (Host/Viewer) with distinct icons
- Quality metrics (FPS, latency, bandwidth) in compact grid

**Remote Screen Viewer:**
- Full-bleed canvas with subtle 1px border
- Scaling controls: Fit-to-window, 100%, custom zoom
- Corner overlay for quick actions (screenshot, fullscreen)
- Loading state: skeleton with connection progress

**Control Toolbar:**
- Icon-only buttons with tooltips (minimize visual weight)
- Grouped logically: Input (keyboard/mouse), Display (quality), Session (disconnect)
- Floating semi-transparent bar (backdrop-blur-md) on hover
- Auto-hide after 3s of inactivity

**Session Management:**
- Card-based session creation with QR code option
- Recent sessions list with timestamps and durations
- Clean table for active connections (if multi-session)

**Status Indicators:**
- Connection quality: Green (excellent), Amber (fair), Red (poor) with signal bar icon
- Input mode: Keyboard icon (enabled) vs ghost (disabled)
- Recording/streaming: Red dot with subtle pulse animation

**Form Elements:**
- Input fields: h-10, rounded-lg, ring on focus
- Buttons: h-10, px-6, rounded-md, semi-bold text
- Toggle switches for settings (permissions, audio)

### E. Animations

**Essential Only:**
- Connection status transitions: 200ms ease
- Toolbar slide-in: 150ms ease-out
- Modal overlays: 200ms fade + scale(0.95)
- NO scroll animations, NO decorative effects

---

## Page Structure

**Host View:**
1. Header (h-16): Session ID, copy button, connection count, end session
2. Main Area: "Waiting for connection" state OR active connections grid (if multiple viewers)
3. Settings Panel (collapsible): Screen selection, quality presets, permissions
4. Footer: Status bar with latency, FPS, data usage

**Viewer View:**
1. Minimal header (h-12): Session status, quality indicator, disconnect
2. Full-screen canvas: Remote desktop display with auto-scaling
3. Floating controls (bottom-right): Input toggle, display settings, fullscreen
4. Connection lost overlay: Reconnection UI with retry button

**Landing/Home:**
1. Split layout: Host (left) | Viewer (right)
2. Each side: Large icon, action button, recent sessions below
3. Feature highlights: Security (end-to-end), Speed (WebRTC), Simplicity
4. No hero image - function-first interface

---

## Images

**No decorative images** - this is a utility application. Use:
- Icons: Heroicons (outline style) for all UI elements via CDN
- Illustrations: Optional simple line illustrations for empty states only
- Avatars: Use colored circles with initials for multi-user scenarios

---

## Accessibility & Technical

- High contrast mode support (WCAG AAA where possible)
- Keyboard shortcuts overlay (Ctrl+/ to display)
- Screen reader announcements for connection status changes
- Focus indicators: 2px ring with 2px offset
- All interactive elements minimum 44x44px touch target