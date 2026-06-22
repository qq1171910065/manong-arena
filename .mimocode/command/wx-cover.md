---
description: "Generate a 900x383 tech-style cover image for WeChat public account articles using Python Pillow"
---

# WeChat Cover Image Generator

Generate a tech-style cover image (900x383px) for WeChat public account articles.

## Parameters

- `$ARGUMENTS` — optional overrides. Supported keys:
  - `title=...` — main title text (default: `AI日报`)
  - `subtitle=...` — subtitle text (default: `每日精选AI资讯`)
  - `output=...` — output file path (default: `scripts/wx_cache/cover_custom.png`)
  - `style=...` — color scheme: `blue` (default), `purple`, `green`
  - `size=...` — dimensions in WxH format (default: `900x383`)

## Procedure

1. Parse any parameter overrides from `$ARGUMENTS`.
2. Write a Python script using `Pillow` that:
   - Creates a canvas with the target dimensions.
   - Draws a dark gradient background (deep navy/black for `blue`, dark violet/black for `purple`, dark teal/black for `green`).
   - Adds decorative AI-themed elements: concentric circles, grid lines, small glowing dots at intersections, thin circuit-like lines.
   - Renders the title text in large white font, centered horizontally.
   - Renders the subtitle in smaller light gray font below the title.
   - Saves as PNG to the output path.
3. Run the script with `python`.
4. Verify the output image exists and has the correct dimensions using `PIL.Image.open()`.
5. Display the image to the user.

## Style Notes

- Keep the design clean and minimal — avoid clutter.
- Use transparency and subtle glow effects where possible.
- The overall feel should be "tech news briefing" — professional, modern, scannable.
- Ensure the output directory exists before writing.
