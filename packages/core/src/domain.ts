/**
|--------------------------------------------------
| Supported source language
|--------------------------------------------------
*/
type SourceLanguage = 'javascript' | 'typescript';

/**
|--------------------------------------------------
| Supported backend framework
|--------------------------------------------------
*/
type BackendFramework = 'express' | 'fastify' | 'generic-node' | 'nestjs' | 'unknown';

/**
|--------------------------------------------------
| Detected backend root
|--------------------------------------------------
*/
interface BackendRoot {
	/**
	|--------------------------------------------------
	| Stable backend root identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Backend root path relative to the scanned workspace
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Human-readable backend root name
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Primary source language detected for the backend
	|--------------------------------------------------
	*/
	language: SourceLanguage;

	/**
	|--------------------------------------------------
	| Framework detected from available project evidence
	|--------------------------------------------------
	*/
	framework: BackendFramework;

	/**
	|--------------------------------------------------
	| Discovery confidence represented from zero to one
	|--------------------------------------------------
	*/
	confidence: number;

	/**
	|--------------------------------------------------
	| Evidence explaining the backend classification
	|--------------------------------------------------
	*/
	evidence: string[];

	/**
	|--------------------------------------------------
	| Modules discovered inside the backend root
	|--------------------------------------------------
	*/
	modules: BackendModule[];
}

/**
|--------------------------------------------------
| Backend source file
|--------------------------------------------------
*/
interface BackendSourceFile {
	/**
	|--------------------------------------------------
	| Absolute file system path
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| File language detected by the active language
	| adapter
	|--------------------------------------------------
	*/
	language: SourceLanguage;

	/**
	|--------------------------------------------------
	| Stable hash of the source contents used for
	| stale-file protection
	|--------------------------------------------------
	*/
	contentHash: string;

	/**
	|--------------------------------------------------
	| Whether version control reports uncommitted
	| changes for the file
	|--------------------------------------------------
	*/
	dirty: boolean;

	/**
	|--------------------------------------------------
	| Whether the discovery engine believes the file
	| was generated
	|--------------------------------------------------
	*/
	generated: boolean;

	/**
	|--------------------------------------------------
	| Whether the language parser accepted the source
	|--------------------------------------------------
	*/
	syntaxValid: boolean;

	/**
	|--------------------------------------------------
	| Parser diagnostics associated with the source
	|--------------------------------------------------
	*/
	diagnostics: SourceDiagnostic[];

	/**
	|--------------------------------------------------
	| Module specifiers imported by the source
	|--------------------------------------------------
	*/
	imports: string[];

	/**
	|--------------------------------------------------
	| Names exported by the source
	|--------------------------------------------------
	*/
	exports: string[];

	/**
	|--------------------------------------------------
	| Top-level declarations discovered in the source
	|--------------------------------------------------
	*/
	symbols: SourceSymbol[];
}

/**
|--------------------------------------------------
| Source parser diagnostic
|--------------------------------------------------
*/
interface SourceDiagnostic {
	/**
	|--------------------------------------------------
	| Human-readable parser diagnostic
	|--------------------------------------------------
	*/
	message: string;

	/**
	|--------------------------------------------------
	| One-based source line when available
	|--------------------------------------------------
	*/
	line?: number;

	/**
	|--------------------------------------------------
	| One-based source column when available
	|--------------------------------------------------
	*/
	column?: number;
}

/**
|--------------------------------------------------
| Source declaration kind
|--------------------------------------------------
*/
type SourceSymbolKind = 'class' | 'enum' | 'function' | 'interface' | 'type' | 'variable';

/**
|--------------------------------------------------
| Top-level source declaration
|--------------------------------------------------
*/
interface SourceSymbol {
	/**
	|--------------------------------------------------
	| Declared symbol name
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Declaration kind
	|--------------------------------------------------
	*/
	kind: SourceSymbolKind;

	/**
	|--------------------------------------------------
	| Whether declaration is exported
	|--------------------------------------------------
	*/
	exported: boolean;
}

/**
|--------------------------------------------------
| Discovered backend module
|--------------------------------------------------
*/
interface BackendModule {
	/**
	|--------------------------------------------------
	| Stable module identifier scoped to the scanned
	| workspace
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Human-readable module name displayed during
	| selection
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Module path relative to its detected backend root
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Source files owned by the module
	|--------------------------------------------------
	*/
	files: BackendSourceFile[];

	/**
	|--------------------------------------------------
	| Framework detected for the module when one is known
	|--------------------------------------------------
	*/
	framework: BackendFramework;

	/**
	|--------------------------------------------------
	| Discovery confidence represented as a value from
	| zero to one
	|--------------------------------------------------
	*/
	confidence: number;
}

/**
|--------------------------------------------------
| Formatting run phase
|--------------------------------------------------
*/
type FormattingRunPhase =
	| 'analysis'
	| 'applying'
	| 'deterministic-formatting'
	| 'discovery'
	| 'semantic-formatting'
	| 'validation';

/**
|--------------------------------------------------
| Formatting progress snapshot
|--------------------------------------------------
*/
interface FormattingProgress {
	/**
	|--------------------------------------------------
	| Current weighted completion percentage from zero
	| to one hundred
	|--------------------------------------------------
	*/
	percentage: number;

	/**
	|--------------------------------------------------
	| Current formatting pipeline phase
	|--------------------------------------------------
	*/
	phase: FormattingRunPhase;

	/**
	|--------------------------------------------------
	| Total number of selected modules
	|--------------------------------------------------
	*/
	modulesTotal: number;

	/**
	|--------------------------------------------------
	| Number of modules that reached a terminal state
	|--------------------------------------------------
	*/
	modulesCompleted: number;

	/**
	|--------------------------------------------------
	| Total number of selected files
	|--------------------------------------------------
	*/
	filesTotal: number;

	/**
	|--------------------------------------------------
	| Number of files that reached a terminal state
	|--------------------------------------------------
	*/
	filesCompleted: number;

	/**
	|--------------------------------------------------
	| Module currently receiving work when one is active
	|--------------------------------------------------
	*/
	currentModuleId?: string;

	/**
	|--------------------------------------------------
	| File currently receiving work when one is active
	|--------------------------------------------------
	*/
	currentFilePath?: string;
}

/**
|--------------------------------------------------
| Deterministic source text edit
|--------------------------------------------------
*/
interface SourceTextEdit {
	/**
	|--------------------------------------------------
	| Zero-based source offset where replacement begins
	|--------------------------------------------------
	*/
	start: number;

	/**
	|--------------------------------------------------
	| Zero-based source offset where replacement ends
	|--------------------------------------------------
	*/
	end: number;

	/**
	|--------------------------------------------------
	| Replacement source text
	|--------------------------------------------------
	*/
	text: string;
}

/**
|--------------------------------------------------
| Export core domain contracts
|--------------------------------------------------
*/
export type {
	BackendRoot,
	SourceSymbol,
	BackendModule,
	SourceLanguage,
	SourceTextEdit,
	BackendFramework,
	SourceDiagnostic,
	BackendSourceFile,
	FormattingProgress,
	FormattingRunPhase,
	SourceSymbolKind,
};
