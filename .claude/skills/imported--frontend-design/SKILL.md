---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when asked to build web components, pages, or applications — websites, landing pages, dashboards, HTML/CSS layouts, or when styling/beautifying any web UI. Generates creative, polished code that avoids generic AI aesthetics.
user-invocable: true
disable-model-invocation: false
---

# Frontend Design

*Imported from [anthropics/skills](https://github.com/anthropics/skills) — Anthropic's official skills repository.*

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before coding, understand the context and commit to a **bold** aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a distinct aesthetic — brutally minimal, maximalist, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian. Use these for inspiration but design one that is true to the vision
- **Constraints**: Technical requirements (framework, performance, accessibility)
- **Differentiation**: What makes this unforgettable? What's the one thing someone will remember?

**Critical**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter. Pair a distinctive display font with a refined body font
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables. Dominant colors with sharp accents outperform timid, evenly-distributed palettes
- **Motion**: Use animations for effects and micro-interactions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density
- **Backgrounds & Visual Details**: Create atmosphere and depth — gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays

## What to Avoid

Never use generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

**Match implementation complexity to the aesthetic vision.** Maximalist designs need elaborate animations and effects. Minimalist designs need restraint, precision, and careful spacing/typography.

## Applying to This Repo

When building new pages in `live-site-pages/`, use the appropriate HTML template from `live-site-pages/templates/` (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt` or `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) as a starting point, then apply these design principles to create a distinctive page that still includes the required version polling, splash overlay, and auto-refresh infrastructure.

Developed by: LightAISolutions
