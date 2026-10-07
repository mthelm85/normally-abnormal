import { getContext, setContext } from 'svelte';
import { clamp } from './util';

/**
 * How "alive" a chart is. Article charts get STILL (fully drawn, no cursor).
 * Front-page charts sit inside a <MovingPicture>, which supplies a Reel that
 * loops: draw in → point at things → ink fades → draw again.
 */
export interface Motion {
	/** 0 → nothing drawn, 1 → fully drawn */
	readonly reveal: number;
	/** 0..1 sweep through the data while holding, or null when not pointing */
	readonly cursor: number | null;
	/** overall ink opacity, used for the fade between loops */
	readonly fade: number;
}

export const STILL: Motion = { reveal: 1, cursor: null, fade: 1 };

const KEY = Symbol('dd-motion');
export const setMotion = (m: Motion) => setContext(KEY, m);
export const getMotion = (): Motion => getContext<Motion>(KEY) ?? STILL;

/** Height for compact charts, set by the front page per story slot. */
const PLATE = Symbol('dd-plate');
export const setPlateHeight = (h: number) => setContext(PLATE, h);
export const plateHeight = (fallback = 150): number => getContext<number>(PLATE) ?? fallback;

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeBack = (t: number) => {
	const c1 = 1.4;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Per-mark progress so marks draw one after another rather than all at once. */
export function stagger(reveal: number, i: number, n: number, spread = 0.6): number {
	if (reveal >= 1) return 1;
	const start = n <= 1 ? 0 : (i / (n - 1)) * spread;
	return clamp((reveal - start) / (1 - spread));
}

// Phases of one performance (fractions of its length).
const FADE = 0.08; // ink fades off the plate
const DRAW = 0.38; // …and is drawn in again
const POINT = 0.95; // the cursor walks the data; then it settles back to rest

/**
 * One plate's moving picture. At rest it shows the finished chart, perfectly
 * still; the Projectionist picks when it gives a single performance.
 */
export class Reel implements Motion {
	/** 0..1 through the current performance, or null when at rest */
	t = $state<number | null>(null);
	visible = false;
	duration = 10000;

	constructor(readonly length = 10000) {}

	get playing() {
		return this.t !== null;
	}

	get reveal() {
		const p = this.t;
		if (p === null || p < FADE) return 1;
		return p < DRAW ? easeInOut((p - FADE) / (DRAW - FADE)) : 1;
	}

	get cursor() {
		const p = this.t;
		return p !== null && p >= DRAW && p < POINT ? (p - DRAW) / (POINT - DRAW) : null;
	}

	get fade() {
		const p = this.t;
		return p !== null && p < FADE ? 1 - easeInOut(p / FADE) : 1;
	}

	start() {
		// Each performance runs a little faster or slower than the last.
		this.duration = this.length * (0.85 + Math.random() * 0.3);
		this.t = 0;
	}

	/** Advances playback; returns true when the performance has finished. */
	advance(dt: number) {
		if (this.t === null) return false;
		this.t = Math.min(1, this.t + dt / this.duration);
		if (this.t < 1) return false;
		this.t = null;
		return true;
	}

	/** Registers with the projectionist while the plate is mounted. Returns a cleanup. */
	run(el: Element) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
		// Freeze-frame for designing previews: /?frame=0.5 holds every plate at that point.
		const frame = new URLSearchParams(location.search).get('frame');
		if (frame !== null) {
			this.t = clamp(+frame, 0, 0.999);
			return () => {};
		}
		const io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
		io.observe(el);
		projectionist.add(this);
		return () => {
			io.disconnect();
			projectionist.remove(this);
		};
	}
}

/** Random wait in ms, roughly log-uniform between lo and hi — mostly short, now and then long. */
const wait = (lo: number, hi: number) =>
	Math.exp(Math.log(lo) + Math.random() * (Math.log(hi) - Math.log(lo)));

/**
 * Decides which plates perform, so a page never has more than two moving at
 * once. Slot A refills quickly; slot B waits longer, so usually one plate is
 * moving, sometimes two, and occasionally none.
 */
interface Slot {
	reel: Reel | null;
	/** projectionist-clock time when this slot may start its next performance */
	at: number;
	/** [shortest, longest] rest in ms after a performance ends */
	gap: [number, number];
}

class Projectionist {
	private reels = new Set<Reel>();
	private slots: Slot[] = [
		{ reel: null, at: 700, gap: [1200, 4000] },
		{ reel: null, at: 6000, gap: [5000, 14000] }
	];
	private lastPlayed: Reel | null = null;
	private clock = 0;
	private raf = 0;
	private last = 0;

	add(reel: Reel) {
		this.reels.add(reel);
		if (!this.raf) {
			this.last = performance.now();
			this.raf = requestAnimationFrame(this.tick);
		}
	}

	remove(reel: Reel) {
		this.reels.delete(reel);
		for (const s of this.slots) if (s.reel === reel) this.free(s);
		if (this.reels.size === 0) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
			// A fresh page starts its first performance promptly.
			this.clock = 0;
			this.slots[0].at = 700;
			this.slots[1].at = 6000;
		}
	}

	private free(slot: Slot) {
		slot.reel = null;
		slot.at = this.clock + wait(...slot.gap);
	}

	private tick = (now: number) => {
		const dt = Math.min(now - this.last, 100);
		this.last = now;
		if (!document.hidden) {
			this.clock += dt;
			for (const slot of this.slots) {
				if (slot.reel) {
					if (slot.reel.advance(dt)) {
						this.lastPlayed = slot.reel;
						this.free(slot);
					}
				} else if (this.clock >= slot.at) {
					const next = this.pick();
					if (next) {
						slot.reel = next;
						next.start();
					} else slot.at = this.clock + 500;
				}
			}
		}
		this.raf = requestAnimationFrame(this.tick);
	};

	/** A random on-screen plate that isn't already playing, avoiding an immediate encore. */
	private pick() {
		const idle = [...this.reels].filter((r) => r.visible && !r.playing);
		const fresh = idle.filter((r) => r !== this.lastPlayed);
		const pool = fresh.length ? fresh : idle;
		return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
	}
}

const projectionist = new Projectionist();
