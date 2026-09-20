# ProbaSight brand assets

## In use

| File | Role |
| --- | --- |
| `probasight-mark.png` | The ProbaSight symbol, 512x512 RGBA. Header and footer marks. |

The mark is referenced by [`src/components/layout/Logo.tsx`](../../src/components/layout/Logo.tsx)
via a single constant:

```ts
const BRAND_MARK_SRC = "/brand/probasight-mark.png";
```

It is rendered through `next/image`, not a raw `<img>`. The source file is ~276 KB, and a
raw tag would download all of it to paint a 28 px header icon on every page; Next serves a
resized modern-format derivative instead (measured: 7 KB at `w=128`). `object-contain`
inside a square box preserves the aspect ratio, so the mark is never stretched or squashed.

## Icons (separate files, not driven by the constant above)

| File | Role |
| --- | --- |
| `src/app/favicon.ico` | Browser tab icon. Three entries: 16, 32 and 48 px. |
| `src/app/apple-icon.png` | iOS home-screen icon, 180x180, opaque dark background. |
| `src/app/opengraph-image.png` | Social preview card, 1200x630. |

These use Next's App Router file conventions, so Next generates the `<link>` and
`<meta property="og:image">` tags automatically. `layout.tsx` deliberately does **not**
declare an `icons` block, so the files cannot disagree with the metadata.

## Replacing an asset

1. Drop the new file in, keeping the same path and filename.
2. For the mark, any square-ish image works; update `BRAND_MARK_SRC` only if you change
   the filename.
3. For icons, use the **symbol only**, never the wordmark: lettering is unreadable at
   16x16. Regenerate `apple-icon.png` (180x180, opaque background, iOS ignores alpha) and
   `opengraph-image.png` (1200x630) to match.
4. Check the result on the dark theme background (`#080B10`), which is the default.

## Constraint

The ProbaSight logo must not reuse or resemble a Panta logo. ProbaSight is an independent
product built on the Panta API; Panta attribution is a separate element rendered by
`src/components/common/PoweredByPanta.tsx`.
