/**
|--------------------------------------------------
| A single archive entry: a path and its raw bytes
|--------------------------------------------------
*/
export interface ZipEntry {
	path: string;
	data: Uint8Array<ArrayBuffer>;
}

export interface FolderFile {
	file: File;
	path: string;
}

/**
|--------------------------------------------------
| CRC32 lookup table used by the browser zip writer
|--------------------------------------------------
*/
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
	let crc = value;
	for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
	return crc >>> 0;
});

/**
|--------------------------------------------------
| Calculate the CRC32 checksum required by zip files
|--------------------------------------------------
*/
const crc32 = (bytes: Uint8Array) => {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
};

/**
|--------------------------------------------------
| Encode a little-endian zip record
|--------------------------------------------------
*/
const record = (size: number, write: (view: DataView) => void) => {
	const bytes = new Uint8Array(size);
	write(new DataView(bytes.buffer));
	return bytes;
};

/**
|--------------------------------------------------
| Build an uncompressed (stored) ZIP from raw entries
|--------------------------------------------------
*/
export function createZip(entries: ZipEntry[], filename = 'codexa-folder.zip'): File {
	/**
	|--------------------------------------------------
	| Accumulate local and central directory records
	|--------------------------------------------------
	*/
	const encoder = new TextEncoder();
	const localParts: BlobPart[] = [];
	const centralParts: BlobPart[] = [];
	let offset = 0;

	for (const entry of entries) {
		/**
		|--------------------------------------------------
		| Encode the entry name and checksum its data
		|--------------------------------------------------
		*/
		const name = encoder.encode(entry.path.replaceAll('\\', '/'));
		const data = entry.data;
		const checksum = crc32(data);

		/**
		|--------------------------------------------------
		| Write the local file header
		|--------------------------------------------------
		*/
		const local = record(30, (view) => {
			view.setUint32(0, 0x04034b50, true);
			view.setUint16(4, 20, true);
			view.setUint16(6, 0x0800, true);
			view.setUint16(8, 0, true);
			view.setUint16(10, 0, true);
			view.setUint16(12, 0, true);
			view.setUint32(14, checksum, true);
			view.setUint32(18, data.length, true);
			view.setUint32(22, data.length, true);
			view.setUint16(26, name.length, true);
		});

		/**
		|--------------------------------------------------
		| Write the central directory header
		|--------------------------------------------------
		*/
		const central = record(46, (view) => {
			view.setUint32(0, 0x02014b50, true);
			view.setUint16(4, 20, true);
			view.setUint16(6, 20, true);
			view.setUint16(8, 0x0800, true);
			view.setUint16(10, 0, true);
			view.setUint16(12, 0, true);
			view.setUint16(14, 0, true);
			view.setUint32(16, checksum, true);
			view.setUint32(20, data.length, true);
			view.setUint32(24, data.length, true);
			view.setUint16(28, name.length, true);
			view.setUint32(42, offset, true);
		});

		localParts.push(local, name, data);
		centralParts.push(central, name);
		offset += local.length + name.length + data.length;
	}

	/**
	|--------------------------------------------------
	| Write the end-of-central-directory record
	|--------------------------------------------------
	*/
	const centralSize = centralParts.reduce((total, part) => total + (part as Uint8Array).byteLength, 0);
	const end = record(22, (view) => {
		view.setUint32(0, 0x06054b50, true);
		view.setUint16(8, entries.length, true);
		view.setUint16(10, entries.length, true);
		view.setUint32(12, centralSize, true);
		view.setUint32(16, offset, true);
	});

	return new File([...localParts, ...centralParts, end], filename, { type: 'application/zip' });
}

/**
|--------------------------------------------------
| Read a browser folder selection into archive entries
|--------------------------------------------------
*/
export async function entriesFromFiles(files: (File | FolderFile)[]): Promise<ZipEntry[]> {
	/**
	|--------------------------------------------------
	| Read each file's bytes, keying by its relative path
	|--------------------------------------------------
	*/
	return Promise.all(
		files.map(async (entry) => {
			const file = entry instanceof File ? entry : entry.file;
			const path = entry instanceof File ? file.webkitRelativePath || file.name : entry.path;
			return {
				path: path.replaceAll('\\', '/'),
				data: new Uint8Array(await file.arrayBuffer()),
			};
		}),
	);
}

/**
|--------------------------------------------------
| Convert a browser folder selection into a ZIP file
|--------------------------------------------------
*/
export async function zipFiles(files: (File | FolderFile)[]): Promise<File> {
	/**
	|--------------------------------------------------
	| Read the files and build a stored archive
	|--------------------------------------------------
	*/
	return createZip(await entriesFromFiles(files));
}

/**
|--------------------------------------------------
| Read recursively dropped files and folders
|--------------------------------------------------
*/
export async function folderFilesFromDrop(items: DataTransferItemList): Promise<FolderFile[]> {
	const entries = Array.from(items)
		.filter((item) => item.kind === 'file')
		.map((item) => item.webkitGetAsEntry?.())
		.filter((entry): entry is FileSystemEntry => Boolean(entry));

	if (entries.length === 0) {
		return Array.from(items)
			.map((item) => item.getAsFile())
			.filter((file): file is File => Boolean(file))
			.map((file) => ({ file, path: file.name }));
	}

	const files = (await Promise.all(entries.map((entry) => readDroppedEntry(entry, '')))).flat();
	return files.sort((left, right) => left.path.localeCompare(right.path));
}

const readDroppedEntry = async (entry: FileSystemEntry, parent: string): Promise<FolderFile[]> => {
	const path = parent ? `${parent}/${entry.name}` : entry.name;
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) =>
			(entry as FileSystemFileEntry).file(resolve, reject),
		);
		return [{ file, path }];
	}
	if (!entry.isDirectory) return [];

	const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
	return (await Promise.all(children.map((child) => readDroppedEntry(child, path)))).flat();
};

const readDirectoryEntries = async (entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
	const reader = entry.createReader();
	const entries: FileSystemEntry[] = [];
	while (true) {
		const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
		if (batch.length === 0) return entries;
		entries.push(...batch);
	}
};

/**
|--------------------------------------------------
| Inflate a raw DEFLATE payload using the platform
|--------------------------------------------------
*/
const inflateRaw = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> => {
	/**
	|--------------------------------------------------
	| Require the streaming decompression API
	|--------------------------------------------------
	*/
	if (typeof DecompressionStream === 'undefined') {
		throw new Error('This browser cannot read compressed ZIP archives.');
	}

	/**
	|--------------------------------------------------
	| Pipe the bytes through a deflate-raw stream
	|--------------------------------------------------
	*/
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
|--------------------------------------------------
| Read a ZIP file into its decompressed entries
|--------------------------------------------------
*/
export async function readZip(file: File): Promise<ZipEntry[]> {
	/**
	|--------------------------------------------------
	| Load the archive bytes and locate the directory
	|--------------------------------------------------
	*/
	const buffer = new Uint8Array(await file.arrayBuffer());
	const view = new DataView(buffer.buffer);

	/**
	|--------------------------------------------------
	| Scan backwards for the end-of-central-directory
	|--------------------------------------------------
	*/
	let eocd = -1;
	for (let index = buffer.length - 22; index >= 0; index -= 1) {
		if (view.getUint32(index, true) === 0x06054b50) {
			eocd = index;
			break;
		}
	}
	if (eocd < 0) throw new Error('Not a valid ZIP archive.');

	/**
	|--------------------------------------------------
	| Walk the central directory entry by entry
	|--------------------------------------------------
	*/
	const count = view.getUint16(eocd + 10, true);
	const decoder = new TextDecoder();
	const entries: ZipEntry[] = [];
	let pointer = view.getUint32(eocd + 16, true);

	for (let n = 0; n < count; n += 1) {
		/**
		|--------------------------------------------------
		| Stop on a malformed central directory header
		|--------------------------------------------------
		*/
		if (view.getUint32(pointer, true) !== 0x02014b50) break;

		/**
		|--------------------------------------------------
		| Read the header fields needed to extract data
		|--------------------------------------------------
		*/
		const method = view.getUint16(pointer + 10, true);
		const compressedSize = view.getUint32(pointer + 20, true);
		const nameLength = view.getUint16(pointer + 28, true);
		const extraLength = view.getUint16(pointer + 30, true);
		const commentLength = view.getUint16(pointer + 32, true);
		const localOffset = view.getUint32(pointer + 42, true);
		const name = decoder.decode(buffer.subarray(pointer + 46, pointer + 46 + nameLength));
		pointer += 46 + nameLength + extraLength + commentLength;

		/**
		|--------------------------------------------------
		| Skip directory entries
		|--------------------------------------------------
		*/
		if (name.endsWith('/')) continue;

		/**
		|--------------------------------------------------
		| Resolve the data start from the local header
		|--------------------------------------------------
		*/
		const localNameLength = view.getUint16(localOffset + 26, true);
		const localExtraLength = view.getUint16(localOffset + 28, true);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

		/**
		|--------------------------------------------------
		| Decode stored or deflated payloads
		|--------------------------------------------------
		*/
		if (method === 0) entries.push({ path: name, data: compressed.slice() });
		else if (method === 8) entries.push({ path: name, data: await inflateRaw(compressed) });
		else throw new Error(`Unsupported ZIP compression (method ${method}) for "${name}".`);
	}

	return entries;
}
