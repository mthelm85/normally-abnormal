# Normally Abnormal

*Why the Average Misleads, and What to Ask Instead* — a short book by Matt Helm,
built with SvelteKit 3 + Svelte 5 + mdsvex and fully prerendered. The chart kit and
look are copied from The Data Dispatch.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # prerenders every page
npm run check    # types
```

## Layout

```
src/
  chapters/<nn>-<slug>/    one folder per chapter (the URL is /<slug>)
    index.svx              frontmatter (number, title, summary) + prose + chart tags
    data/*.csv             written by julia/chNN.jl; `import rows from './data/x.csv'`
    charts/                (optional) one-off components for this chapter
  lib/
    charts/                the chart kit, imported as '#charts'
    styles/                tokens.css (paper, ink, accents, fonts), base.css (prose)
    chapters.ts            book title + chapter registry (globs src/chapters)
  routes/                  title page + contents, /[chapter]
julia/
  common.jl                chapter_rng, write_csv, fmt
  chNN.jl                  one script per chapter
```

## Adding a chapter

Create `src/chapters/02-lopsided/index.svx`:

```svelte
---
number: 2
title: "Lopsided"
summary: "Skew pulls the mean away from the typical case."
---

<script>
	import { LineChart } from '#charts';
	import incomes from './data/incomes.csv';
</script>

Prose in **markdown**…

<LineChart data={incomes} x="x" y="density" area title="…" source="Simulated" />
```

It appears in the contents automatically, ordered by `number`.

## Figure data from Julia

```bash
cd julia
julia --project -e 'using Pkg; Pkg.instantiate()'   # first time only
julia --project ch01.jl
```

Each figure function calls `write_csv(CH, "name", "col" => values, ...)`, which writes
`src/chapters/<nn>-*/data/name.csv` in wide format (one column per series). Seeds come
from `chapter_rng(n; stream)`, so every run gives identical numbers.

## The chart kit (`#charts`)

| Component   | Use for                       | Key props                                                               |
| ----------- | ----------------------------- | ----------------------------------------------------------------------- |
| `Density`   | a distribution's shape        | `x`, `y`, `markers` (mean/median/mode or a number), `shade`, `notes`, `dashed` |
| `LineChart` | curves, running means         | `x`, `y` (string or array), `area`, `zero`, `yDomain`, `notes`, `curve` |
| `BarChart`  | categories, counts            | `x`, `y`, `horizontal`, `highlight`, `hatched`, `values`, `domain`      |
| `Scatter`   | two measures                  | `x`, `y`, `label`, `labelled`, `trend`                                  |
| `Dumbbell`  | before/after per row          | `label`, `from`, `to`                                                   |
| `Donut`     | parts of a whole              | `label`, `value`, `inner`, `unit`                                       |
| `Radar`     | profiles across many measures | `axis`, `y`, `domain`                                                   |
| `Table`     | tabular matter                | `rows`, sortable headers                                                |

Building blocks for custom charts: `Figure`, `AxisX`, `AxisY`, `Tooltip`, `ChartDefs`
(hatch patterns `url(#dd-hatch-N)`), and helpers in `util.ts`.

Planned for the book: `Histogram`, `SmallMultiples`, `Strip`.

### Density example

```svelte
<Density data={incomes} x="x" y="lognormal" xLabel="Income ($ thousands)"
	markers={[{ x: 'mode' }, { x: 'median' }, { x: 'mean' }]}
	shade={[{ from: 100, label: 'the top tenth' }]}
	notes={[{ x: 160, text: 'a long tail of high earners' }]}
	title="A Lopsided Shape" source="Simulated" />
```

Data comes from `density_csv` in `julia/common.jl`. Statistics named as strings are computed
from the curve; for heavy tails, pass the true value from Julia as a number. Hovering shows
the share of the distribution below the pointer.
