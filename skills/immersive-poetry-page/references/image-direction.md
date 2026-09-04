# Image direction

## Visual bible

Define before generating:

- medium: historical film still, macro diorama photography, photographic landscape, restrained painterly cinema;
- period and geography;
- recurring characters: age, clothing, silhouette, props, placement;
- palette: 4–6 descriptive colors;
- light progression across beats;
- lens and composition language;
- material list;
- avoid list.

Repeat the stable parts of this bible in every prompt. Consistency is more important than novelty.

## Hero prompt structure

```text
Use case: historical-scene.
Asset type: cinematic landing-page hero for <title>.
Scene: <entire emotional world in one composition>.
Style/medium: <realistic medium and production quality>.
Composition/framing: wide 16:9, <focal layout>, negative space on <side> for Chinese typography.
Lighting/mood: <time, weather, emotional temperature>.
Materials/textures: <specific surfaces>.
Constraints: no text, calligraphy, logos, signatures, seals, watermarks, or modern objects.
Avoid: cartoon, low-poly, plastic toys, generic game art, oversaturation, fantasy unless required.
```

## Beat prompt structure

```text
Create scene <N> for the same <title> website, matching the hero exactly in world design,
geography, recurring characters, period, materials, color science, weather, lens language,
and cinematic treatment.

Primary subject: “<original line>” — <filmable scene>.
Composition: 16:9; <focal subject placement>; negative space on <copy side>.
Lighting: <beat-specific progression>.
Mood: <beat-specific emotion>.
Constraints and avoid list: <repeat the shared invariants>.
```

## Consistency rules

- Generate hero first and refer to it in every subsequent prompt.
- Recurring figures must keep age, hair, clothing family, silhouette, and props.
- Keep geography navigable: the same river, village, mountain, road, room, or battlefield should remain recognizable.
- Move the camera and emphasis, not the entire art direction.
- Use a logical light progression when the poem changes time.

## Common failures

- “Ancient Chinese style” alone produces generic fantasy.
- Miniature/diorama without “physically realistic macro photography” produces plastic toys.
- War prompts without restraint produce video-game spectacle.
- Asking for calligraphy inside images creates corrupted text; render all text in HTML.
- One prompt generating multiple distinct scenes weakens control; use separate calls.
- An image can look excellent alone yet drift from the set. Always inspect a contact sheet.
