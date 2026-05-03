# Platform Guides — Ramble On

Reference for Mode C (Platform Post) translations. Each platform has different structural expectations, tone conventions, and technical requirements. Read the relevant section before generating.

---

## Medium

**Audience:** Thoughtful generalists. Tech, business, culture, personal growth. Skimmers who stop when something hits.

**Title:**
- 60 characters max for SEO
- Question or tension performs better than statement ("Why X is wrong" > "About X")
- Avoid clickbait but don't be boring — earn the click

**Subtitle:**
- 140 characters max
- Clarifies the value or angle. The title hooks; the subtitle converts.

**Structure:**
- **Hook paragraph** (2–4 sentences, no setup, straight to it)
- **Body sections** with H2 subheadings (3–6 sections typical)
- **Closing** with real takeaway or question — not a summary
- Pull quotes work well for emphasis (use `>` blockquote)

**Length:** 1,000–2,500 words is the Medium sweet spot. Under 800 reads like a tweet thread. Over 3,000 needs to justify the length.

**Tags:** 1–5, lowercase, specific. Bad: `technology`. Good: `machine-learning`, `product-design`.

**Voice:** Conversational but substantive. First-person is standard. You can say "I" freely.

**What Medium readers hate:**
- Listicles without depth
- Corporate speak
- Vague inspiration without examples
- "In today's fast-paced world..."

**KB cross-link note:** Medium doesn't support internal links to other platforms. Suggest linking to prior Medium posts if any exist in KB.

---

## Substack

**Audience:** Subscribers who opted in. More intimate than Medium. Readers expect a relationship, not just content.

**Subject line (email):** This is the title. It's also a subject line. It needs to work as both. Keep it under 60 chars. Curiosity > keyword optimization.

**Structure:**
- **Lede** — one strong paragraph that states the point or sets the scene
- **Body** — can be looser than Medium. Section headers optional but useful for longer posts.
- **Sign-off** — personal, direct. Often ends with a question or invite to reply.

**Length:** Flexible. Substack works at 500 words (a quick take) or 3,000 (a deep essay). Match length to depth of idea.

**Tone:** More personal than Medium. First-person. You can show your thinking process. Readers are here for the author, not just the topic.

**What Substack readers hate:**
- Feeling like they're reading a generic blog post
- No perspective — just information
- Weak endings (don't trail off)

**Technical notes:**
- Substack renders markdown but has its own editor — paste draft, format there
- Images go between sections; don't rely on them for meaning
- Footnotes work well for asides or caveats

---

## Ghost (Self-hosted Blog)

**Audience:** Depends on the blog, but typically more technically sophisticated readers who sought it out.

**Structure:**
- More flexibility than Medium/Substack
- Can go long. Ghost readers often want depth.
- Table of contents useful for posts over 2,000 words

**SEO considerations (if the user cares about them):**
- Meta description should be 155 characters
- H2/H3 structure matters for search
- Slug should be clean: `my-topic-name` not `my-topic-name-2026-01`

**Tone:** Author-defined. Match to the established blog voice if KB has examples.

**Technical:**
- Ghost supports full markdown + HTML
- Cards (embedded content) available in Ghost editor
- Tags function as categories — suggest 1–3

---

## LinkedIn

**Audience:** Professional network. Career, business, industry takes.

**The LinkedIn algorithm rewards:**
- Posts that generate comments (ask questions)
- Native content (no external links in first comment or body — add to comments)
- First 2–3 lines that make people click "see more"

**Structure:**
- **Line 1:** The hook (before the "see more" cutoff — ~200 chars)
- **Body:** Short paragraphs, 1–3 sentences each. Lots of white space.
- **Ending:** Question or observation that invites engagement

**Length:** 1,300 characters is the LinkedIn sweet spot for organic reach. Can go to 3,000 but diminishing returns.

**Tone:** Professional but human. First person. Personal stories + professional insight = the formula that works.

**What kills LinkedIn posts:**
- Wall-of-text formatting
- Pure self-promotion with no insight
- Fake inspiration ("I was told I'd never make it...")
- Putting the URL in the post body (always first comment)

---

## Personal Blog / Custom Site

When the user has their own site, check KB for:
- Existing posts that establish voice and structure
- A style guide file if they've created one
- Platform specifics (WordPress, Astro, Jekyll, etc. — markdown compatibility varies)

In absence of KB context for personal blog, default to:
- Clean markdown
- Ghost-compatible formatting (broadly compatible)
- Author-defined voice (use whatever calibration exists)

---

## Quick Platform Decision Guide

| If they're publishing to... | Mode | Tone | Length sweet spot |
|-----------------------------|------|------|-------------------|
| Medium | Thoughtful essay | Conversational/substantive | 1,200–2,000 words |
| Substack | Personal take/newsletter | Intimate/direct | 500–2,500 words |
| Ghost blog | Deep post | Author-defined | 1,500–3,500 words |
| LinkedIn | Professional insight | Professional/human | 800–1,300 chars |
| Personal site | Flexible | Author-defined | Match to content |

---

*Last updated: 2026. Platform algorithms and norms shift — flag if these feel out of date.*
