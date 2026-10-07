// Chapter notes: each <Note> registers itself here in reading order, and
// <NotesScope> lists them all after the chapter, like endnotes in a printed book.
import { getContext, setContext, type Snippet } from 'svelte';

export interface NoteEntry {
	n: number;
	/** id of the note's marker in the text, for the back-link */
	ref: string;
	/** id of the note in the list */
	id: string;
	content: Snippet;
}

export class NoteList {
	items = $state<NoteEntry[]>([]);
	add(content: Snippet): NoteEntry {
		const n = this.items.length + 1;
		const entry = { n, ref: `note-ref-${n}`, id: `note-${n}`, content };
		this.items.push(entry);
		return entry;
	}
}

const KEY = Symbol('chapter-notes');
export const setNotes = (list: NoteList) => setContext(KEY, list);
export const getNotes = (): NoteList | undefined => getContext<NoteList>(KEY);
