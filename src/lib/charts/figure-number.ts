import { getContext, setContext } from 'svelte';

/** A chart's place in its chapter, set by the build-time figure numbering. */
export interface FigureNumber {
	/** "1.2" */
	n: string;
	/** anchor id, for "Figure 1.2" links in the text */
	id: string;
}

const KEY = Symbol('figure-number');
export const setFigureNumber = (f: FigureNumber) => setContext(KEY, f);
export const getFigureNumber = () => getContext<FigureNumber | undefined>(KEY);
