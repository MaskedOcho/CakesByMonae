# Higgsfield AI background video: "the cake builds itself"

The hero section plays `assets/hero-cake-build.mp4` as a looping, muted background.
Until that file exists, the site shows an animated CSS cake building itself instead.

## Recommended workflow
1. **Start from a real photo** (best results): pick one of Mone't's signature cakes from Instagram
   and use Higgsfield's **image-to-video** so the AI builds *her* cake, not a generic one.
2. Generate in **16:9, 1080p**, ~5–10 seconds. Keep the background **black** and leave the **left third darker / empty**, because the headline sits there.
3. Pick a camera preset like **Slow Push-In**, **Orbit**, or **Crane Up** for a premium feel.

## Prompts (copy/paste), matched to the Cake'd By Mone'T neon look

**Main: neon cake builds itself**
> Cinematic macro shot on a pure black background with glowing neon light. On a neon-pink cake board, a custom cake assembles itself layer by layer: sponge tiers float down and land softly, white buttercream spreads smooth on its own, hot pink, purple, cyan and lime green rainbow drip icing cascades over the edges, then colorful sprinkles rain down in slow motion, a gold crown topper lands on top and a candle ignites. Hot pink and electric purple rim lighting, gold sparkles in the air, shallow depth of field, slow camera push-in, glossy 4K dessert commercial.

**Alt: cupcake tower build**
> Black studio with neon pink and cyan glow. Cupcakes drop into place one by one forming a tower: vanilla with rainbow sprinkles, chocolate, strawberry topped with a fresh strawberry, cookies & cream with an Oreo, red velvet, Biscoff. Frosting swirls pipe themselves on top. Sparkles and confetti sprinkles burst, glossy slow motion, vibrant neon party vibe.

**Alt: brownie + mini cake drop (for a second section later)**
> Fudgy brownies stack themselves on a black background while caramel and white icing drizzle down, Biscoff cookies and Oreo crumbs fall on top. Neon pink and lime green glow, slow motion, macro food commercial.

**Image-to-video tip:** upload the cupcake flyer or a real cupcake photo as the start frame so the AI matches her actual cupcakes.

**Negative prompt (if available):** text, watermark, logos, distorted hands, melting mess, low quality, cartoon, daylight, white background.

## Making it loop smoothly
- Generate one clip, then export it, plus a second clip using the final frame as the start image for the reveal.
- Or just let it fade: the site fades the video in over 1.2s, and a slow push-in loops acceptably.

## Exporting for the web
- Save as `assets/hero-cake-build.mp4` (H.264). Aim for **under 8 MB**.
- Save a still frame as `assets/hero-poster.jpg` (it shows while the video loads).
- To compress it (needs ffmpeg):
  `ffmpeg -i input.mp4 -vcodec libx264 -crf 28 -preset slow -an -vf scale=1920:-2 -movflags +faststart assets/hero-cake-build.mp4`
  (`-an` strips audio, which background video doesn't need.)
