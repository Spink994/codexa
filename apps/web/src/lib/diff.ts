/**
|--------------------------------------------------
| A single line in a unified diff
|--------------------------------------------------
*/
export interface DiffLine {
	type: 'add' | 'del' | 'context';
	text: string;
}

/**
|--------------------------------------------------
| Compute a line-level unified diff via LCS
|--------------------------------------------------
*/
export function diffLines(before: string, after: string): DiffLine[] {
	/**
	|--------------------------------------------------
	| Split both sources into lines
	|--------------------------------------------------
	*/
	const a = before.replace(/\n$/, '').split('\n');
	const b = after.replace(/\n$/, '').split('\n');

	/**
	|--------------------------------------------------
	| Build the longest-common-subsequence table
	|--------------------------------------------------
	*/
	const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i -= 1) {
		for (let j = b.length - 1; j >= 0; j -= 1) {
			lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	/**
	|--------------------------------------------------
	| Backtrack the table into diff operations
	|--------------------------------------------------
	*/
	const lines: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			lines.push({ type: 'context', text: a[i] });
			i += 1;
			j += 1;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			lines.push({ type: 'del', text: a[i] });
			i += 1;
		} else {
			lines.push({ type: 'add', text: b[j] });
			j += 1;
		}
	}

	/**
	|--------------------------------------------------
	| Flush the remaining tail of each side
	|--------------------------------------------------
	*/
	while (i < a.length) {
		lines.push({ type: 'del', text: a[i] });
		i += 1;
	}
	while (j < b.length) {
		lines.push({ type: 'add', text: b[j] });
		j += 1;
	}

	/**
	|--------------------------------------------------
	| Return the unified diff lines
	|--------------------------------------------------
	*/
	return lines;
}
