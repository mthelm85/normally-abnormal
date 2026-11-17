// Thumbnails for the landing page: each essay's featured distribution, drawn as an
// idealized (parametric) curve so the three read as a progression: a symmetric
// bell, a lopsided hump, then a cliff with an endless tail. Keyed by part number;
// a part without one gets the series emblem instead. Points are [x, y] in any
// units; the thumbnail rescales them to fit.
export interface Thumb {
	points: [number, number][];
	/** fill under the curve */
	area: boolean;
	/** what it shows, for screen readers */
	label: string;
}

const N = 241;
const grid = (lo: number, hi: number) => Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));

// Normal(0, 1)
const normal = (x: number) => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
// Lognormal(μ = 0, σ = 0.6)
const lognormal = (x: number, s = 0.6) =>
	x <= 0 ? 0 : Math.exp(-(Math.log(x) ** 2) / (2 * s * s)) / (x * s * Math.sqrt(2 * Math.PI));
// Pareto(x_min = 1, α = 1.16): the "80/20" exponent; zero below x_min, then the cliff
const pareto = (x: number, a = 1.16) => (x < 1 ? 0 : a / x ** (a + 1));

export const THUMBS: Record<number, Thumb> = {
	1: {
		points: grid(-3.6, 3.6).map((x) => [x, normal(x)]),
		area: true,
		label: 'A normal distribution: a symmetric bell'
	},
	2: {
		points: grid(0, 4.5).map((x) => [x, lognormal(x)]),
		area: true,
		label: 'A lognormal distribution: a hump that leans left with a long tail to the right'
	},
	3: {
		// x_min sits just after the left edge, with the step drawn as a vertical rise
		points: [[0, 0] as [number, number], [1, 0] as [number, number], ...grid(1, 9).map((x) => [x, pareto(x)] as [number, number])],
		area: true,
		label: 'A Pareto (power-law) distribution: nothing below a minimum, then a cliff and a very long tail'
	}
};
