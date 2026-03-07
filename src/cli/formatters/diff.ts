import chalk from 'chalk';
import type { DiffResult } from '../../shared/types.js';

export function formatDiffSummary(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold('Diff Summary'));
  lines.push(`  ${chalk.green(`+ ${diff.added.length} added`)}`);
  lines.push(`  ${chalk.yellow(`~ ${diff.changed.length} changed`)}`);
  lines.push(`  ${chalk.red(`- ${diff.removed.length} removed`)}`);

  if (diff.added.length > 0) {
    lines.push('');
    lines.push(chalk.green.bold('Added:'));
    for (const rec of diff.added.slice(0, 10)) {
      const label = rec.title || rec.name || rec._id;
      lines.push(chalk.green(`  + ${label}`));
    }
    if (diff.added.length > 10) {
      lines.push(chalk.dim(`  ... and ${diff.added.length - 10} more`));
    }
  }

  if (diff.changed.length > 0) {
    lines.push('');
    lines.push(chalk.yellow.bold('Changed:'));
    for (const rec of diff.changed.slice(0, 10)) {
      lines.push(chalk.yellow(`  ~ ${rec.recordId} [${rec.changedFields.join(', ')}]`));
      for (const field of rec.changedFields) {
        lines.push(chalk.dim(`      ${field}: `) + chalk.red(String(rec.before[field] ?? '')) + ' → ' + chalk.green(String(rec.after[field] ?? '')));
      }
    }
  }

  if (diff.removed.length > 0) {
    lines.push('');
    lines.push(chalk.red.bold('Removed:'));
    for (const rec of diff.removed.slice(0, 10)) {
      const label = rec.title || rec.name || rec._id;
      lines.push(chalk.red(`  - ${label}`));
    }
    if (diff.removed.length > 10) {
      lines.push(chalk.dim(`  ... and ${diff.removed.length - 10} more`));
    }
  }

  return lines.join('\n');
}
