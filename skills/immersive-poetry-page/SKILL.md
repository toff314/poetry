---
name: immersive-poetry-page
description: Turn any Chinese classical poem, ci, qu, or prose-poem into a cinematic, immersive scroll-driven webpage with historically and emotionally appropriate AI-generated imagery, line-by-line interpretation, visual storytelling, responsive design, and browser QA. Use when the user supplies ancient Chinese poetry and asks for an atmospheric page, interactive appreciation experience, visual interpretation, educational poem website, or image-led literary presentation.
---

# Immersive Poetry Page

Create a complete webpage, not a mockup. Preserve the poem exactly, generate a coherent image set, implement scroll-driven scene transitions, explain the poem clearly, build the project, and visually inspect it.

## Non-negotiable quality bar

- Treat imagery as the poem's emotional world, not decoration.
- Prefer cinematic realism, high-end historical photography, crafted diorama realism, or restrained ink-inspired cinematography according to the poem. Never default to low-poly, cartoon, plastic-toy, or generic “ancient style.”
- Use one visual bible across every generated image: same geography, characters, era, palette, materials, weather, camera language, and time progression.
- Keep image files free of text, calligraphy, logos, seals, signatures, and watermarks. Add typography in HTML.
- Never replace or overwrite an existing poetry page unless the user explicitly asks. Create a new route/page and link the pages.
- State textual variants instead of silently “correcting” the user's poem.

## Required workflow

### 1. Inspect the project

Identify the framework, build scripts, existing pages, design system, dev-server state, and dirty files. Reuse the current stack. For Vite multi-page sites, add a new HTML entry and configure `build.rollupOptions.input` when needed.

### 2. Build the literary scene map

Read [references/poetry-analysis.md](references/poetry-analysis.md). Produce internally:

- verified title, author, era, genre/ci tune;
- 5–8 visual beats based on imagery, action, time, and emotional turns—not equal line counts;
- for every beat: original text, plain meaning, core images, technique, emotional function, and proposed scene;
- the overall arc, such as `landscape → history → hero → self → release`.

Use the supplied text verbatim in the page. If a common textual variant matters, mention it in explanatory copy without derailing the experience.

### 3. Choose an art direction

Read [references/image-direction.md](references/image-direction.md). Select a visual form from the poem itself:

- intimate travel, village, still life → realistic handcrafted diorama or macro historical photography;
- war, rivers, mountains, political history → large-scale prestige historical cinema;
- dream, myth, celestial, highly metaphorical work → restrained painterly cinema with physically credible light;
- quiet philosophical poem → minimal photographic landscape with negative space.

Default to a hero plus one image per major beat. Six to eight total images usually balances immersion, consistency, and load time.

### 4. Generate and persist the image set

Use the local `doubao-cli` tool for image generation. Issue one generation call per distinct asset; do not use one generic prompt for all images. Default to `--ratio 16:9`. Save each returned image under `public/generated/<poem-slug>/` with a stable name.

Generate the hero first. Each later prompt must explicitly match the hero's world design, characters, geography, lighting, material realism, lens language, and color grade. Reserve negative space on the side where page copy will sit.

After generation:

1. Persist all selected images inside the project, normally `public/generated/<poem-slug>/`.
2. Create a contact sheet and inspect all images together.
3. Reject or repair images with style drift, accidental text/seals, wrong era, malformed focal subjects, or mismatched recurring characters.
4. Preserve originals and create compressed JPEG/WebP derivatives where available. Aim for roughly 250–600 KB per 1672×941 JPEG.

Do not integrate uninspected generated assets.

### 5. Implement the webpage

Read [references/page-pattern.md](references/page-pattern.md). Prefer the bundled files in `assets/page-template/` as the starting point when the project has no stronger existing pattern.

Required page anatomy:

1. Hero: title, author/era, a defining line, a short invitation, and a scroll cue.
2. One full-viewport section per visual beat.
3. Each section: original line(s), literal meaning, close reading, and one compact visual device such as keywords, contrast, verb rhythm, emotional scale, or timeline.
4. Closing interpretation: genre/tune, structure, imagery, techniques, emotional arc, and central meaning.
5. Navigation between poetry pages when more than one exists.
6. A narration control. Use the supplied or project-provided audio asset, attempt autoplay, and always keep an accessible play/pause switch because browsers commonly block audible autoplay.

Use a fixed image stage with two overlapping texture planes or image layers. Crossfade when the active section changes; add only subtle zoom or pointer parallax. The image is the protagonist—keep cards translucent, readable, and smaller than half the viewport on desktop.

Do not use paid video generation unless the user explicitly asks. A high-quality image sequence with crossfades is the default.

### 6. Responsive and accessible behavior

- Use semantic headings, sections, buttons, and navigation.
- Keep the full focal subject visible on phones; prefer `contain` with a blurred full-bleed backdrop when a crop would destroy meaning.
- Support `prefers-reduced-motion` by disabling smooth scrolling, parallax, and long fades.
- Maintain readable contrast without dimming the artwork into obscurity.
- Avoid loading all PNG masters; serve compressed derivatives.
- Give the narration button a visible text label, `aria-pressed`, keyboard focus styling, and a local error state. Do not hide the control merely because autoplay failed.

### 7. Verify the result

Run the production build. Then use a real browser to inspect:

- hero after assets finish loading;
- at least two middle sections after the crossfade settles;
- closing interpretation;
- one mobile viewport;
- narration source availability, autoplay fallback, and play/pause state;
- console warnings/errors.

The page fails QA if the generated images are not visibly switching, cards cover the main subjects, text is clipped, the page remains on a loading screen, or the imagery feels unrelated to the poem.

### 8. Deliver

Report:

- the local/page URL;
- source files changed;
- image asset directory;
- contact sheet path;
- prompt-set path;
- narration asset URL or path;
- build and browser-QA result;
- that doubao-cli was used for image generation.

Keep the dev server running when the user wants to review locally.

## Bundled resources

- [references/poetry-analysis.md](references/poetry-analysis.md): textual segmentation and explanation rules.
- [references/image-direction.md](references/image-direction.md): visual bible and image prompt patterns.
- [references/video-direction.md](references/video-direction.md): per-scene video prompts — voiceover/recital, frontend-subtitled vertical verses (no on-image text), virtual-avatar casting, Seedance params & QA.
- [references/page-pattern.md](references/page-pattern.md): page architecture and QA details.
- `assets/page-template/`: generic HTML, TypeScript, CSS, and config starter.
- `scripts/extract_imagegen_results.py`: legacy helper for recovering generated PNGs from a rollout JSONL (usually not needed when using doubao-cli).