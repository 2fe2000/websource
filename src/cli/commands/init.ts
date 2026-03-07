import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { runConversation } from '../prompts/conversation.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init [url]')
    .description('Set up a new data source through guided conversation')
    .action(async (urlArg?: string) => {
      console.log(chalk.bold.blue('websource') + chalk.dim(' — interactive source setup'));
      console.log('');

      let url = urlArg;
      if (!url) {
        url = await input({ message: 'Enter the URL to analyze:' });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        console.error(chalk.red('Invalid URL. Please provide a valid URL (e.g., https://example.com/products)'));
        process.exit(1);
      }

      await runConversation(url);
    });
}
