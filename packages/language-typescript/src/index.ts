/**
|--------------------------------------------------
| Export TypeScript source analyzer
|--------------------------------------------------
*/
export {
	analyzeTypeScriptSource,
	type TypeScriptSourceAnalysis,
} from './analyzer.js';

/**
|--------------------------------------------------
| Export behavior-preservation comparison
|--------------------------------------------------
*/
export {
	compareTypeScriptStructure,
	type BehaviorComparison,
} from './behavior-check.js';

/**
|--------------------------------------------------
| Export Codexa block-comment contracts
|--------------------------------------------------
*/
export {
	isBlockComment,
	renderBlockComment,
	readBlockCommentLabel,
	BLOCK_COMMENT_RULE,
	type BlockCommentTemplate,
} from './block-comment.js';

/**
|--------------------------------------------------
| Export comment boundary detector
|--------------------------------------------------
*/
export {
	detectCommentBoundaries,
	type CommentCandidate,
	type CommentCandidateKind,
	type CommentBoundaryAnalysis,
} from './comment-boundaries.js';

/**
|--------------------------------------------------
| Export semantic diff risk analyzer
|--------------------------------------------------
*/
export {
	assessTypeScriptSemanticRisk,
	type SemanticRiskLevel,
	type SemanticRiskReason,
	type SemanticRiskAssessment,
} from './semantic-risk.js';

/**
|--------------------------------------------------
| Export conservative deterministic formatting
|--------------------------------------------------
*/
export {
	formatTypeScriptDeterministically,
	type DeterministicFormatResult,
} from './deterministic-formatter.js';
export {
	validateTypeScriptStyle,
	type ConformanceCheck,
	type ConformanceCheckStatus,
	type StyleConformanceReport,
} from './style-conformance.js';
export { normalizeTypeScriptStyle, type StyleNormalizationResult } from './style-normalizer.js';
