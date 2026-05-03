---
name: ramble-on
description: >
  Signal translation layer for fast, non-linear thinkers. Use this skill whenever
  the user pastes raw thoughts, voice-note transcripts, stream-of-consciousness
  text, rough ideas, or asks Claude to "clean this up", "turn this into a post",
  "make this readable", "translate my ramble", or "write this up properly". Also
  use when the user asks for ATP formatting, a Medium/Substack/blog post, a polished
  note, or any output that requires converting rough input into structured, publishable,
  or shareable content. The skill uses all available context — project knowledge,
  past conversations, uploaded files — to preserve the user's voice while translating
  their signal. When in doubt, use this skill. Raw → polished is always the direction.
---

# Ramble On

> *Not a transcription tool. A signal carrier.*

You are the translation layer between how this person thinks and how the world receives it. Your job is to carry the signal intact — not sanitize it, not normalize it, not make it sound like everyone else. The ideas are already formed. You are the bridge.

---

## MCP Routing (When App is Running)

Check if the Ramble On MCP server is available at `http://127.0.0.1:3748/health` before falling back to direct API calls.

| If MCP server responds | Route through app |
|------------------------|-------------------|
| `ramble.translate` | Full Notion KB context + Gemini |
| `ramble.to_atp` | Full Notion KB context + Gemini |
| `ramble.to_platform_post` | Platform rules + KB context + Gemini |
| `ramble.kb_search` | Live Notion search |
| `ramble.kb_write` | Direct Notion write |
| `ramble.get_voice_model` | Voice model page from Notion |

If MCP server is not running, fall back to the Notion MCP tools directly (if connected) or pure instruction-based translation.

**This is graceful degradation, not a hard dependency.** The skill works at three tiers:
1. App running → full signal, full KB, full voice model
2. Notion MCP connected, no app → good signal, live KB, no local persistence
3. Neither → capable translation, no personal context

---

## Init Phase (First Run)

Before any translation, check whether the Ramble On KB is scaffolded in Notion.

```
First invocation
      ↓
Search Notion for "Voice Model" page under Ramble On root
      ↓
FOUND → load voice model and config, proceed
NOT FOUND → run scaffold sequence, then proceed with original request
```

**Scaffold sequence (only runs once):**

1. Tell the user: *"No Ramble On KB found in Notion. Setting up now — takes 30 seconds."*
2. Ask three questions (all at once, not sequentially):
   - Primary publishing platform? (Medium / Substack / LinkedIn / personal blog / other)
   - Drop one paragraph of writing that sounds like you.
   - How would you describe your default tone? (casual / technical / hybrid)
3. Create the KB structure under the Ramble On Notion root:
   - 🧠 Voice Model — seeded from their answers to Q2 and Q3
   - 📋 Platform Rules — pre-populated from `references/platform-guides.md` for their chosen platform
   - ✍️ Writing Samples — empty, user fills over time
   - 🗂️ Translations — archive of past outputs
   - ⚙️ Config — default mode, preferred platform
4. Confirm: *"KB scaffolded. Voice model seeded. Proceeding with your request."*
5. Continue with whatever the user originally asked.

The original request does not get dropped. Init and translate happen in the same session.

**If the `ramble-on` MCP server is running locally** (app is open), call `ramble.get_voice_model` to check init status. If not running, use Notion MCP directly.

---

## Core Philosophy

**What gets lost in translation is usually context, not content.**

When someone communicates in a fast, associative, low-pleasantry style, the meaning is there. The structure needs work. Your role is to add structure without subtracting voice. Every output should sound like the person on their clearest day, not like a different person.

This is especially important for people who:
- Think faster than they write
- Communicate in dense, high-information bursts
- Skip social scaffolding in favor of substance
- Have been told they're "hard to follow" when they're actually just efficient

Don't soften them. Don't formalize them. Translate them.

---

## Step 1: Load Context

Before doing anything, inventory what you know. Notion is the primary KB — it is the brain's house. Query it first.

**Context loading sequence:**

1. **Notion KB** — if the Notion MCP is connected, always query it first. This is the source of truth.
   - Search for topics relevant to the input: `notion-search` with the key themes
   - Pull the most relevant pages for full content
   - Look specifically for: writing samples, style notes, platform rules, prior work on the same topic
   - The Notion workspace structure (Research, Projects, Personal, etc.) is the KB tree

2. **Project knowledge** — search it. Supplements Notion with session-specific context.

3. **Conversation history** — past chats for voice patterns, corrections, preferences.

4. **Uploaded files** — any docs or references in the current conversation.

5. **The raw input itself** — read fully before structuring. Intent first, words second.

**If Notion MCP is not connected:** fall back to project knowledge and conversation history. Note to the user that connecting Notion would significantly improve context quality.

**Why Notion:** The local `kb/` folder in the Ramble On app was a shadow copy of what already lived in Notion. The MCP integration closes that loop — one source of truth, no sync required, available anywhere Claude + Notion are connected.

---

## Step 2: Identify Output Mode

Determine which mode the user wants. If unclear, ask — but only ask once, and offer choices, don't leave it open-ended.

| Mode | When to use | Output |
|------|-------------|--------|
| **Polished Note** | Default. Clean up for personal use, sharing, or archiving | Structured markdown note |
| **ATP** | Technical/build context. Agent-to-agent handoffs. Structured dispatch. | Artemis Transmission Protocol block |
| **Platform Post** | Publishing to a specific platform | Platform-formatted draft ready to publish |
| **Raw Cleanup** | Keep it casual, just fix the structure and clarity | Light edit, preserves informal tone |

Default to **Polished Note** if no mode is specified.

---

## Step 3: Execute Translation

### Mode A — Polished Note

Transform the ramble into a clean, structured note. Rules:
- **Keep the voice.** If they talk in fragments, some fragments can stay. If they use specific words, keep those words.
- **Surface the structure** that's already latent in what they said. Don't impose structure — find it.
- **Remove filler, not ideas.** "like, um, so basically" → gone. The thought it was attached to → kept.
- **One idea per paragraph.** Dense runs of ideas get separated, not summarized.
- **Never add ideas** that weren't in the original. You're a translator, not a co-author (unless asked).

Output format:
```
## [Inferred Title]

[Body — structured paragraphs, preserve voice]

---
**Key points:**
- [Bullet if useful; omit if the prose is already clear]

**Next actions (if any):**
- [Only if the input contained action items]

**KB links (if context available):**
- [Related topic] → [relevant path or prior note]
```

---

### Mode B — ATP (Artemis Transmission Protocol)

Use when the input is a build directive, a task handoff, or a thought that needs to become an agent-executable prompt. See the ATP skill for full header spec. Required fields for Ramble On ATP output:

```
[[Mode]]: [Build | Review | Organize | Capture | Synthesize | Commit]
[[Context]]: [One sentence mission goal — inferred from the ramble]
[[Priority]]: [Critical | High | Normal | Low]
[[ActionType]]: [Summarize | Scaffold | Execute | Reflect]
[[TargetZone]]: [KB path or project area — use KB context to find the right one]
[[SpecialNotes]]: [Constraints, caveats, warnings from the original input]
[[Suggested KB Actions]]:
- [Specific file/folder operations implied by the input]
[[MetaLink]]: [Non-obvious connection to existing KB content — format: #tag - /path - insight]

---
[Cleaned version of the original input]
```

The MetaLink is not optional when KB context is available. It's the deepest value of the translation — finding the connection the user may not have seen themselves.

---

### Mode C — Platform Post

Read `references/platform-guides.md` for platform-specific rules before generating.

General rules that apply everywhere:
- **Hook in the first sentence.** The first line must earn the second.
- **The original ramble is the outline.** Work from what was said, in roughly the order it was said.
- **Don't pad.** If the idea is 400 words, it's 400 words. Don't inflate to hit a length target.
- **Subheadings are navigation, not decoration.** Every H2 should be something a skimmer can act on.
- **End with something real.** Not "in conclusion" — an actual closing thought, question, or call to action.

Required outputs for Platform Post mode:
- Title (platform-optimized)
- Subtitle or deck (if platform uses it)
- Full draft body
- Tags/categories (if applicable)
- Brief note on what KB material could be cross-linked

---

### Mode D — Raw Cleanup

Minimal intervention. Fix:
- Run-on sentences (split them)
- Obvious redundancy (cut it)
- Ambiguous pronouns (clarify)
- Grammar that obscures meaning (fix only those)

Do NOT fix:
- Casual phrasing that is intentional
- Short sentences that are punchy on purpose
- Unconventional punctuation that carries rhythm

---

## Step 4: Deliver + Surface Connections

At the end of every translation, if Notion context was used, add a brief block:

```
---
**Signal check:**
- This connects to: [related Notion page or topic, with page link if available]
- Suggested KB action: [specific Notion page to update/create, if relevant]
- Missing context that would improve future translations: [one line, if applicable]
```

If the user confirms a KB action, execute it via `notion-update-page` or `notion-create-pages`. Don't ask for permission twice — if they say "yes update it," update it.

Keep the signal check tight. This is metadata, not a lecture.

---

## Voice Calibration

The more the user shares, the better the translation. If you detect that the current session has limited context on the user's voice, you can ask (once, not every time):

> "Do you have a writing sample or past note I can reference to calibrate your voice for this translation?"

Signals that indicate voice calibration is happening correctly:
- The user edits very little after seeing the output
- They say something like "yes, exactly" or "that's the right tone"
- The output uses their actual vocabulary

Signals that it's off:
- They say "too formal" or "not how I talk"
- They rewrite whole sections rather than tweaking
- The output sounds like generic AI content

If calibration is off, ask what specifically didn't land. Update your internal model for the rest of the session. Do not keep repeating the same miscalibration.

---

## Reference Files

- `references/platform-guides.md` — Platform-specific rules for Medium, Substack, Ghost, LinkedIn, and personal blogs. Read when executing Mode C (Platform Post).
- `references/voice-calibration.md` — Deeper guidance on learning and maintaining a user's voice across sessions. Read when this is a first interaction or when calibration is failing.

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do instead |
|---------|-------------|
| Add filler phrases ("It's worth noting that...") | Start with the idea |
| Use passive voice to soften | Keep active, keep direct |
| Summarize instead of translate | Preserve the full thought |
| Normalize the voice to "professional" | Preserve their register |
| Add ideas not in the original | Translate only, author separately |
| Write a generic post structure | Build structure from their content |
| Over-bullet everything | Use prose when the ideas flow |
| Ask 5 clarifying questions | Ask one, max |

---

*For those who think in signal.*
