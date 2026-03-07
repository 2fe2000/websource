// ===== Core Domain Types =====

export interface Source {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Field {
  name: string;
  selector: string;
  fallbackSelectors?: string[];
  attribute?: string; // e.g. "href", "src"; defaults to textContent
  type: FieldType;
  transform?: TransformPipe[];
  required: boolean;
  fromDetailPage?: boolean;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'url' | 'date' | 'image' | 'price' | 'html';

export type TransformPipe =
  | { op: 'trim' }
  | { op: 'lowercase' }
  | { op: 'collapseWhitespace' }
  | { op: 'stripHtml' }
  | { op: 'regex'; pattern: string; group?: number }
  | { op: 'replace'; search: string; replacement: string }
  | { op: 'prefix'; value: string }
  | { op: 'parseNumber'; locale?: string }
  | { op: 'parsePrice' }
  | { op: 'parseDate'; format?: string }
  | { op: 'resolveUrl' }
  | { op: 'parseBoolean' };

export interface PaginationConfig {
  strategy: 'next-link' | 'page-param' | 'offset-param' | 'infinite-scroll';
  nextSelector?: string;
  paramName?: string;
  startValue?: number;
  increment?: number;
  maxPages: number;
}

export interface DetailPageConfig {
  linkSelector: string;
  linkAttribute?: string; // default "href"
  fields: Field[];
  fetchMode?: 'static' | 'rendered';
  rateLimitMs?: number;
}

export interface ExtractionConfig {
  id: string;
  sourceId: string;
  version: number;
  fetchMode: 'static' | 'rendered';
  listSelector: string;
  fields: Field[];
  pagination?: PaginationConfig;
  detailPage?: DetailPageConfig;
  rateLimitMs: number;
  timeoutMs: number;
  maxRetries: number;
  robotsPolicy: 'respect' | 'ignore';
  userAgent?: string;
  isActive: boolean;
  createdAt: string;
}

// ===== Extraction Results =====

export interface ExtractedRecord {
  _id: string;
  _sourceUrl: string;
  _extractedAt: string;
  _confidence: number;
  [fieldName: string]: unknown;
}

export interface Run {
  id: string;
  sourceId: string;
  configId: string;
  status: RunStatus;
  trigger: 'manual' | 'scheduled' | 'api';
  startedAt?: string;
  completedAt?: string;
  recordsTotal: number;
  recordsNew: number;
  recordsChanged: number;
  recordsRemoved: number;
  pagesFetched: number;
  errorMessage?: string;
  errorClass?: ErrorClass;
  createdAt: string;
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ErrorClass = 'network' | 'parse' | 'selector' | 'validation' | 'timeout' | 'robots' | 'unknown';

export interface Snapshot {
  id: string;
  runId: string;
  sourceId: string;
  records: ExtractedRecord[];
  recordCount: number;
  contentHash: string;
  createdAt: string;
}

export interface DiffResult {
  id: string;
  sourceId: string;
  snapshotBefore?: string;
  snapshotAfter: string;
  added: ExtractedRecord[];
  changed: ChangedRecord[];
  removed: ExtractedRecord[];
  summary: string;
  createdAt: string;
}

export interface ChangedRecord {
  recordId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedFields: string[];
}

export interface Schedule {
  id: string;
  sourceId: string;
  cronExpr: string;
  preset?: 'hourly' | 'daily' | 'weekly' | 'custom';
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

// ===== Analysis Types =====

export interface SiteAnalysis {
  url: string;
  title: string;
  fetchMode: 'static' | 'rendered';
  pageType: PageType;
  repeatedBlocks: RepeatedBlock[];
  suggestedFields: SuggestedField[];
  paginationHints: PaginationHint[];
  detailLinkHints: DetailLinkHint[];
  robotsAllowed: boolean;
  fetchTimeMs: number;
  renderingScore?: number;
  renderingReasons?: string[];
  ogMetadata?: Record<string, string>;
}

export type PageType = 'list' | 'detail' | 'article' | 'directory' | 'search-results' | 'unknown';

export interface RepeatedBlock {
  selector: string;
  parentSelector: string;
  count: number;
  sampleHtml: string;
  confidence: number;
  fingerprint: string;
}

export interface SuggestedField {
  name: string;
  selector: string;
  fallbackSelectors: string[];
  sampleValues: string[];
  inferredType: FieldType;
  confidence: number;
  inferenceSource: string;
}

export interface PaginationHint {
  strategy: PaginationConfig['strategy'];
  selector?: string;
  urlPattern?: string;
  confidence: number;
}

export interface DetailLinkHint {
  selector: string;
  sampleUrls: string[];
  confidence: number;
}

// ===== Conversational Setup =====

export type ConversationStep =
  | 'url-input'
  | 'analyzing'
  | 'select-block'
  | 'propose-fields'
  | 'pick-fields'
  | 'detail-pages'
  | 'refresh-cadence'
  | 'name-source'
  | 'confirm'
  | 'done';

export interface ConversationState {
  step: ConversationStep;
  url?: string;
  analysis?: SiteAnalysis;
  selectedBlock?: RepeatedBlock;
  selectedFields?: Field[];
  detailPageConfig?: DetailPageConfig;
  schedule?: { cronExpr: string; preset?: string };
  sourceName?: string;
  fetchMode?: 'static' | 'rendered';
}

// ===== Extraction Health =====

export interface ExtractionHealth {
  overallConfidence: number;
  itemCountInRange: boolean;
  requiredFieldCoverage: Record<string, number>;
  degraded: boolean;
  degradationReasons: string[];
}
