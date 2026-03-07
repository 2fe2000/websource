export { runExtraction, type PipelineResult } from './pipeline.js';
export { normalizeRecord, parsePrice, parseDate, parseNumber, parseBoolean } from './normalizer.js';
export { deduplicateRecords } from './deduplicator.js';
export { computeRecordConfidence, assessExtractionHealth } from './validator.js';
