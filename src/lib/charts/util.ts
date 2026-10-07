import { format as d3format } from 'd3-format';
import { utcFormat } from 'd3-time-format';

export type Row = Record<string, any>;
export type Fmt = string | ((v: any) => string);
export type XKind = 'time' | 'linear' | 'band';

export const PALETTE_SIZE = 6;
export const seriesColor = (i: number) => `var(--series-${i % PALETTE_SIZE})`;
export const hatch = (i: number, alt = false) =>
	`url(#dd-hatch${alt ? '-alt' : ''}-${i % PALETTE_SIZE})`;

export const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function inferKind(values: unknown[]): XKind {
	if (values.every((v) => v instanceof Date)) return 'time';
	if (values.every((v) => typeof v === 'number')) return 'linear';
	return 'band';
}

/** Turns a d3-format string, a function, or nothing into a formatter. */
export function formatter(f: Fmt | undefined, fallback: (v: any) => string): (v: any) => string {
	if (!f) return fallback;
	if (typeof f === 'function') return f;
	return d3format(f);
}

export const fmtYear = (v: number) => String(Math.round(v));
export const fmtMonth = utcFormat('%b %Y');
export const fmtMonthLong = utcFormat('%B %Y');
export const fmtNumber = d3format(',~r');

/** Generic, compact number formatting for labels: 1,234 · 0.43 · 12.9 */
export function smartNumber(v: number): string {
	if (v == null || Number.isNaN(v)) return '—';
	const a = Math.abs(v);
	if (a >= 1e6) return d3format('.3~s')(v).replace('G', 'B');
	if (a >= 1000) return d3format(',.0f')(v);
	if (a >= 100) return d3format('.0f')(v);
	if (a >= 1) return d3format('.3~r')(v);
	return d3format('.3~r')(v);
}

/** Rough text width for the typewriter face at a given size (it's condensed). */
export const textWidth = (s: string, size = 12) => String(s).length * size * 0.5;

/** Breaks a label into at most `lines` lines of ~maxChars, ellipsising overflow. */
export function wrap(label: string, maxChars: number, lines = 2): string[] {
	const words = String(label).split(/\s+/);
	const out: string[] = [];
	let cur = '';
	for (const w of words) {
		if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
		else {
			if (cur) out.push(cur);
			cur = w;
		}
	}
	if (cur) out.push(cur);
	if (out.length > lines) {
		const kept = out.slice(0, lines);
		kept[lines - 1] = kept[lines - 1].replace(/[,;:]?$/, '…');
		return kept;
	}
	return out;
}

export interface Note {
	/** x value (year, date string, category) the note points at */
	x: any;
	/** series key (line charts) or y value; defaults to the first series */
	y?: string | number;
	text: string;
	/** text offset from the point, in px */
	dx?: number;
	dy?: number;
}

export const sameX = (a: any, b: any) => {
	if (a instanceof Date || b instanceof Date) return +new Date(a) === +new Date(b);
	return String(a) === String(b);
};

/** Dev-only: warn when a chart asks for columns its data doesn't have (it would draw nothing). */
export function checkColumns(chart: string, data: Row[], columns: (string | undefined)[]) {
	if (!import.meta.env.DEV || !data.length) return;
	const have = Object.keys(data[0]);
	const missing = columns.filter((c): c is string => !!c && !have.includes(c));
	if (missing.length)
		console.warn(
			`[${chart}] no column ${missing.map((m) => `"${m}"`).join(', ')}. Columns are: ${have.join(', ')}`
		);
}
