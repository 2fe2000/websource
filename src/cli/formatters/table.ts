import Table from 'cli-table3';
import chalk from 'chalk';
import type { Source, Run, Field, SuggestedField, RepeatedBlock } from '../../shared/types.js';
import { truncate } from '../../shared/utils.js';

export function formatSourcesTable(sources: Source[]): string {
  if (sources.length === 0) return chalk.dim('No sources found. Run `websource init` to create one.');

  const table = new Table({
    head: [chalk.bold('ID'), chalk.bold('Name'), chalk.bold('URL'), chalk.bold('Status'), chalk.bold('Created')],
    colWidths: [15, 25, 40, 10, 22],
    wordWrap: true,
  });

  for (const s of sources) {
    table.push([
      s.id,
      s.name,
      truncate(s.url, 38),
      s.status === 'active' ? chalk.green(s.status) : chalk.dim(s.status),
      s.createdAt.slice(0, 19),
    ]);
  }

  return table.toString();
}

export function formatRunsTable(runs: Run[]): string {
  if (runs.length === 0) return chalk.dim('No runs found.');

  const table = new Table({
    head: [chalk.bold('ID'), chalk.bold('Status'), chalk.bold('Trigger'), chalk.bold('Records'), chalk.bold('+New'), chalk.bold('~Changed'), chalk.bold('-Removed'), chalk.bold('Date')],
  });

  for (const r of runs) {
    const statusColor = r.status === 'completed' ? chalk.green : r.status === 'failed' ? chalk.red : chalk.yellow;
    table.push([
      r.id,
      statusColor(r.status),
      r.trigger,
      r.recordsTotal,
      chalk.green(`+${r.recordsNew}`),
      chalk.yellow(`~${r.recordsChanged}`),
      chalk.red(`-${r.recordsRemoved}`),
      (r.completedAt || r.createdAt).slice(0, 19),
    ]);
  }

  return table.toString();
}

export function formatFieldsTable(fields: SuggestedField[]): string {
  const table = new Table({
    head: [chalk.bold('#'), chalk.bold('Field'), chalk.bold('Type'), chalk.bold('Confidence'), chalk.bold('Sample Values')],
  });

  fields.forEach((f, i) => {
    table.push([
      i + 1,
      chalk.cyan(f.name),
      f.inferredType,
      confidenceBar(f.confidence),
      truncate(f.sampleValues.slice(0, 3).join(' | '), 50),
    ]);
  });

  return table.toString();
}

export function formatBlocksTable(blocks: RepeatedBlock[]): string {
  const table = new Table({
    head: [chalk.bold('#'), chalk.bold('Selector'), chalk.bold('Count'), chalk.bold('Confidence')],
  });

  blocks.forEach((b, i) => {
    table.push([i + 1, truncate(b.selector, 50), b.count, confidenceBar(b.confidence)]);
  });

  return table.toString();
}

export function formatRecordsTable(records: Record<string, unknown>[], fields: string[]): string {
  if (records.length === 0) return chalk.dim('No records extracted.');

  const displayFields = fields.filter((f) => !f.startsWith('_'));
  const table = new Table({
    head: displayFields.map((f) => chalk.bold(f)),
    wordWrap: true,
  });

  for (const rec of records.slice(0, 20)) {
    table.push(displayFields.map((f) => truncate(String(rec[f] ?? ''), 40)));
  }

  if (records.length > 20) {
    return table.toString() + chalk.dim(`\n... and ${records.length - 20} more records`);
  }

  return table.toString();
}

function confidenceBar(value: number): string {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
  return color(`${pct}%`);
}
