# ProbaSight brand assets

Drop a supplied logo file here and the app will use it in place of the inline SVG mark.

## Expected paths

| File | Used for |
| --- | --- |
| `probasight-mark.svg` or `.png` | Square symbol only. Header, footer, favicon. **Preferred.** |
| `probasight-wordmark.svg` or `.png` | "ProbaSight" lettering only, no symbol. |
| `probasight-logo.svg` or `.png` | Symbol plus lettering, horizontal lockup. |

SVG is preferred over PNG: it stays sharp at every size and needs no retina variant.
If supplying PNG, provide the mark at **512x512** or larger, with a transparent background.

## How to switch the app over

One line, in [`src/components/layout/Logo.tsx`](../../src/components/layout/Logo.tsx):

```ts
const BRAND_MARK_SRC: string | null = "/brand/probasight-mark.svg";
```

The mark is rendered inside a square box with `object-contain`, so the aspect ratio is
always preserved. A non-square asset is letterboxed rather than stretched or squashed.

Leaving the constant `null` keeps the built-in inline SVG, which follows the theme
tokens and is resolution-independent. Nothing breaks if this directory stays empty.

## Favicon and app icon

These are generated from separate files and are **not** switched by the constant above:

- `src/app/icon.svg` - browser favicon
- `src/app/apple-icon.png` - 180x180 iOS home-screen icon

Replace those two directly if the supplied asset should become the icon as well. Use the
**symbol only**, never the wordmark: lettering is unreadable at 16x16.

## Constraints

- The ProbaSight logo must not reuse or resemble a Panta logo. ProbaSight is an
  independent product built on the Panta API; Panta attribution is a separate element
  rendered by `src/components/common/PoweredByPanta.tsx`.
- Check any new asset on a dark background (`#080B10`), since the UI is dark by default.
