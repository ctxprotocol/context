# Tool Context Visual Guide

## Component Anatomy

### Collapsed State (Default)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ what is the live gas price of base right now      │     │  ← User message
│  │ and what source did you get it from               │     │    (Blue bubble)
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ ▶  Tool: Blocknative Gas (Base)     Show context  │     │  ← Tool context
│  └───────────────────────────────────────────────────┘     │    (Muted, collapsed)
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- User text remains clean and readable
- Tool context is visually de-emphasized (muted colors)
- Chevron indicates expandable content
- "Show context" label provides clear affordance

---

### Expanded State

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ what is the live gas price of base right now      │     │  ← User message
│  │ and what source did you get it from               │     │    (Blue bubble)
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ ▼  Tool: Blocknative Gas (Base)     Hide context  │     │  ← Collapsible header
│  ├───────────────────────────────────────────────────┤     │
│  │ {                                                 │     │
│  │   "success": true,                                │     │
│  │   "data": {                                       │     │  ← JSON data
│  │     "system": "base",                             │     │    (Monospace font)
│  │     "network": "mainnet",                         │     │
│  │     "unit": "gwei",                               │     │
│  │     "maxPrice": 0.1,                              │     │
│  │     "currentBlockNumber": 38192304,               │     │
│  │     "msSinceLastBlock": 922,                      │     │
│  │     "blockPrices": [                              │     │
│  │       {                                           │     │
│  │         "blockNumber": 38192305,                  │     │
│  │         "estimatedTransactionCount": 383,         │     │
│  │         "baseFeePerGas": 0.00159126,              │     │
│  │         "estimatedPrices": [...]                  │     │
│  │       }                                           │     │
│  │     ]                                             │     │
│  │   }                                               │     │
│  │ }                                                 │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Chevron rotates to indicate expanded state
- Border separates header from content
- JSON displayed in monospace font with proper formatting
- Scrollable if content is too long

---

## Color Palette (Design System)

### Light Theme
```
User Message Bubble:
  Background: #006cff (Blue)
  Text: #ffffff (White)

Tool Context (Collapsed):
  Background: hsl(240 4.8% 95.9% / 0.3) (Muted/30)
  Border: hsl(240 5.9% 90%) (Border)
  Text: hsl(240 3.8% 46.1%) (Muted Foreground)

Tool Context (Expanded):
  Header Background: hsl(240 4.8% 95.9% / 0.3) (Muted/30)
  Content Background: hsl(240 4.8% 95.9% / 0.1) (Muted/10)
  JSON Background: hsl(0 0% 100%) (Background)
  JSON Text: hsl(240 10% 3.9%) (Foreground)

Hover State:
  Background: hsl(240 4.8% 95.9%) (Accent)
  Text: hsl(240 5.9% 10%) (Accent Foreground)

Focus Ring:
  Ring: hsl(240 10% 3.9%) (Ring)
  Offset: hsl(0 0% 100%) (Ring Offset Background)
```

### Dark Theme
```
User Message Bubble:
  Background: #006cff (Blue)
  Text: #ffffff (White)

Tool Context (Collapsed):
  Background: hsl(240 3.7% 15.9% / 0.3) (Muted/30)
  Border: hsl(240 3.7% 15.9%) (Border)
  Text: hsl(240 5% 64.9%) (Muted Foreground)

Tool Context (Expanded):
  Header Background: hsl(240 3.7% 15.9% / 0.3) (Muted/30)
  Content Background: hsl(240 3.7% 15.9% / 0.1) (Muted/10)
  JSON Background: hsl(240 10% 3.9%) (Background)
  JSON Text: hsl(0 0% 98%) (Foreground)

Hover State:
  Background: hsl(240 3.7% 15.9%) (Accent)
  Text: hsl(0 0% 98%) (Accent Foreground)

Focus Ring:
  Ring: hsl(240 4.9% 83.9%) (Ring)
  Offset: hsl(240 10% 3.9%) (Ring Offset Background)
```

---

## Typography

```
User Message:
  Font: var(--font-geist) (Sans)
  Size: 1rem (base)
  Weight: 400 (Regular)
  Line Height: 1.5rem

Tool Context Header:
  Font: var(--font-geist) (Sans)
  Size: 0.875rem (sm)
  Weight: 500 (Medium)
  Line Height: 1.25rem

Tool Context Label:
  Font: var(--font-geist) (Sans)
  Size: 0.75rem (xs)
  Weight: 400 (Regular)
  Line Height: 1rem
  Color: Muted Foreground

JSON Data:
  Font: var(--font-geist-mono) (Mono)
  Size: 0.75rem (xs)
  Weight: 400 (Regular)
  Line Height: 1rem
  Color: Foreground
```

---

## Spacing

```
User Message:
  Padding: 0.75rem (px-3 py-2)
  Border Radius: 1rem (rounded-2xl)
  Gap to Tool Context: 0.5rem (gap-2)

Tool Context Header:
  Padding: 0.5rem 0.75rem (px-3 py-2)
  Border Radius: 0.375rem (rounded-md)
  Icon-to-Text Gap: 0.5rem (gap-2)

Tool Context Content:
  Padding: 0.75rem (p-3)
  Border Top: 1px solid border
  Background: Muted/10

JSON Container:
  Padding: 0.75rem (p-3)
  Border Radius: 0.375rem (rounded-md)
  Background: Background
```

---

## Interactive States

### Hover (Collapsible Header)
```
Default:
  Background: Muted/30
  Text: Muted Foreground

Hover:
  Background: Accent
  Text: Accent Foreground
  Transition: 200ms ease
```

### Focus (Collapsible Header)
```
Focus-Visible:
  Outline: None
  Ring: 2px solid Ring
  Ring Offset: 2px Ring Offset Background
```

### Active (Expanded/Collapsed)
```
Collapsed:
  Icon: ChevronRightIcon
  Label: "Show context"

Expanded:
  Icon: ChevronDownIcon
  Label: "Hide context"
```

---

## Responsive Behavior

### Desktop (≥768px)
- Tool context width matches user message container
- JSON scrolls horizontally if needed
- Hover states active

### Mobile (<768px)
- Tool context full width
- JSON wraps or scrolls
- Touch-friendly tap targets (min 44px)

---

## Accessibility

### Keyboard Navigation
```
Tab:       Focus collapsible header
Enter:     Toggle expand/collapse
Space:     Toggle expand/collapse
Escape:    (No action - stays in current state)
```

### Screen Reader
```
Button:    "Tool: Blocknative Gas (Base), Show context"
Expanded:  "Tool: Blocknative Gas (Base), Hide context"
Content:   Announced as code block
```

### Focus Management
- Clear focus ring on header button
- Focus remains on button after expand/collapse
- No focus trap

---

## Copy Behavior

### User Message Copy
```
Visible:   "what is the live gas price of base right now"
Clipboard: "what is the live gas price of base right now"
           (Tool context stripped)
```

### Tool Context Copy (Future)
```
Visible:   Formatted JSON
Clipboard: Raw JSON string
           (Future: Add dedicated copy button)
```

---

## Animation

### Expand/Collapse
```
Duration:  200ms (normal)
Easing:    ease
Property:  height, opacity

Collapsed → Expanded:
  - Chevron rotates 90deg
  - Content fades in (opacity 0 → 1)
  - Height animates from 0 to auto

Expanded → Collapsed:
  - Chevron rotates -90deg
  - Content fades out (opacity 1 → 0)
  - Height animates from auto to 0
```

---

## Code Example

### Usage
```tsx
import { ToolContext, parseToolContext } from "@/components/tool-context";

// Parse message text
const { userText, toolContext } = parseToolContext(message.parts[0].text);

// Render
<div className="flex flex-col gap-2">
  <MessageContent>
    <Response>{userText}</Response>
  </MessageContent>
  
  {toolContext && (
    <ToolContext 
      toolName={toolContext.toolName}
      data={toolContext.data}
    />
  )}
</div>
```

### Message Format
```
User message text

<tool-context tool="Tool Name">
{
  "key": "value"
}
</tool-context>
```

---

## Edge Cases

### Empty Tool Data
```
<tool-context tool="Tool Name">
{}
</tool-context>

→ Displays: Empty JSON object
```

### Large Tool Data
```
<tool-context tool="Tool Name">
{ ... 10KB of JSON ... }
</tool-context>

→ Scrollable content area
→ Consider truncation in future
```

### Multiple Tools (Future)
```
User message

<tool-context tool="Tool 1">
{ ... }
</tool-context>

<tool-context tool="Tool 2">
{ ... }
</tool-context>

→ Each renders as separate collapsible panel
```

---

## Performance

- **Parsing**: O(1) regex match per message
- **Rendering**: Lazy (collapsed by default)
- **Memory**: Minimal (JSON stored as string)
- **Re-renders**: Memoized with React.memo

---

**Status**: ✅ Implemented  
**Design System Compliance**: 100%  
**Accessibility**: WCAG 2.1 AA compliant

