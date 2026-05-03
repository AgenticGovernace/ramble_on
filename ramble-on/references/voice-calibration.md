# Voice Calibration — Ramble On

How to learn, maintain, and apply a user's voice across translations. Read this when it's a first interaction, when calibration is failing, or when the user has given explicit feedback that something sounded wrong.

---

## What Voice Is (And Isn't)

**Voice is not:**
- Grammar rules the person follows
- Their vocabulary list
- Their industry or domain

**Voice is:**
- The *rhythm* of their sentences
- How long they let an idea breathe before moving on
- When they use fragments vs full sentences
- Whether they signal transitions or just move
- Their relationship with formality (and where they break it)
- Specific words or phrases they own — words they reach for that others don't
- How much they assume the reader already knows

---

## Initial Calibration Signals

On first encounter, look for these signals in the raw input:

### Sentence rhythm
| Pattern | What it signals |
|---------|-----------------|
| Short. Punchy. Like this. | Keep them. These are intentional. |
| Long, connected clauses that build on each other and rarely stop | Mirror that in the output — don't chop |
| Mixed — short for emphasis, long for explanation | Use the same mix in the output |

### Formality register
| Pattern | What it signals |
|---------|-----------------|
| Uses "gonna", "wanna", "kinda" | Informal is intentional — preserve it |
| Mixes technical precision with casual phrasing | Keep the mix — it's the voice |
| No contractions, formal word choices | Higher register — mirror it |
| Profanity | Match it in the output, or strip entirely if context is professional |

### Information density
| Pattern | What it signals |
|---------|-----------------|
| Few words, high content | They're a compressor — don't inflate |
| Lots of context-setting before the point | They like to frame — don't cut setup entirely |
| Jumps between topics | Non-linear thinker — find the thread, but don't force linear structure |

### Transition style
| Pattern | What it signals |
|---------|-----------------|
| Rarely uses transition words | They connect by juxtaposition — respect it |
| "Also" and "and" to chain ideas | Additive thinker — let it add |
| Explicit signposting ("First... then... finally...") | Linear and explicit — mirror the signposting |

---

## Building the Voice Model

After the first translation in a session, you have a working voice model. Use it. Don't re-derive it from scratch each time.

Maintain a mental (or noted) summary of the key characteristics, e.g.:
> *This user: short sentences for emphasis, technical vocab + casual connectors, skips pleasantries entirely, owns "signal" and "context" as core vocabulary, high-density, prefers prose over bullets*

If you have project knowledge or past conversations, look for:
- Writing samples → rhythm and word choices
- Past translations they approved → what they kept vs. changed
- Explicit feedback on tone → "too formal", "more like how I talk"

---

## Calibration Failure: How to Detect It

Signs the translation is off:
- User rewrites entire sections, not just tweaks
- They say "this sounds like ChatGPT" or "too corporate"
- They use words in their edit that weren't in your output
- They simplify what you wrote (means you inflated)
- They add intensity to what you wrote (means you softened)

**When calibration fails, ask exactly one question:**
> "What felt off — was it the tone, the structure, or something else?"

Don't ask multiple questions. Don't guess out loud. Get the specific diagnosis, then adjust.

---

## Common Miscalibration Patterns

### The Formality Inflation Problem
**What happens:** Raw input is casual; output is polished into professional-speak.
**Why it happens:** Training pressure toward "clean" writing.
**Fix:** Reintroduce contractions, shorter sentences, and informal connectors. "It's" not "It is." "So" not "Therefore."

### The Bullet Compulsion
**What happens:** Every set of ideas gets bulleted, even when the original had prose flow.
**Why it happens:** Bullets feel organized.
**Fix:** If the original didn't have list structure, don't add it. Use bullets only when items are truly parallel and discrete.

### The Hedge Addition
**What happens:** Adding "It's worth noting that..." or "This might be..." when the original was direct.
**Why it happens:** Hedging feels polite and measured.
**Fix:** Directness is the point. Remove hedges unless the original contained uncertainty.

### The Explanation Creep
**What happens:** Expanding what was left implicit.
**Why it happens:** Wanting to make sure the reader understands.
**Fix:** If the user didn't explain it, don't add the explanation. Trust that they know their audience.

### The Vocabulary Swap
**What happens:** Replacing the user's specific word with a "better" synonym.
**Why it happens:** Synonym habit from general writing improvement.
**Fix:** If they said "signal" don't swap it to "message" or "information." Their words are intentional.

---

## Voice Across Platforms

The voice stays consistent; the *format* changes with the platform.

For the same user:
- **LinkedIn post** → Same voice, shorter sentences, more white space
- **Medium essay** → Same voice, more developed reasoning, full prose
- **ATP dispatch** → Same voice, stripped to structured fields

Never change the vocabulary, rhythm, or directness to fit the platform. Change only what the platform requires structurally.

---

## First Session Baseline Questions (if needed)

If there's truly no context and the input doesn't give enough signal to calibrate, you can ask the user one of these:

**Option 1 (writing sample):**
> "Do you have a past note or post I can use to calibrate your voice? Even a paragraph helps."

**Option 2 (direct):**
> "Quick calibration: would you describe your writing style as more formal/professional, casual/direct, or somewhere in between?"

**Option 3 (implied):**
Don't ask anything. Use what's in the input. Make a translation. Let the feedback calibrate you.

Option 3 is usually right. The translation itself is the fastest calibration tool.

---

*The goal is for the user to feel like the output came from them, not from a tool.*
