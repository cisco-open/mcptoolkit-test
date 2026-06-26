// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Completion command - Generate shell completion scripts
 */

import { Command } from 'commander';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Generate bash completion script
 */
function generateBashCompletion(): string {
  return `# mcptest bash completion

_mcptest_completions() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Top-level commands
  local commands="run record generate merge-logs validate schema agents completion"

  # Global options
  local global_opts="--help --version"

  case "\${COMP_CWORD}" in
    1)
      COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
      return 0
      ;;
    2)
      case "\${prev}" in
        run)
          COMPREPLY=( $(compgen -W "--scenarios --server --golden --transport --env --verbose --pretty --help" -- \${cur}) )
          return 0
          ;;
        record)
          COMPREPLY=( $(compgen -W "--scenarios --server --golden --mock-data --export --incremental --fuzzy-match --env --verbose --help" -- \${cur}) )
          return 0
          ;;
        generate)
          COMPREPLY=( $(compgen -W "--mcpdesc --output --coverage --merge --verbose --help" -- \${cur}) )
          return 0
          ;;
        merge-logs)
          COMPREPLY=( $(compgen -W "--old --new --output --verbose --help" -- \${cur}) )
          return 0
          ;;
        validate)
          COMPREPLY=( $(compgen -W "--scenarios --verbose --help" -- \${cur}) )
          return 0
          ;;
        schema)
          COMPREPLY=( $(compgen -W "--json --examples --ai-guide --copilot-prompt --help" -- \${cur}) )
          return 0
          ;;
        agents)
          COMPREPLY=( $(compgen -W "--workflow --copilot --full --help" -- \${cur}) )
          return 0
          ;;
        completion)
          COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
          return 0
          ;;
      esac
      ;;
  esac

  COMPREPLY=( $(compgen -W "\${global_opts}" -- \${cur}) )
}

complete -F _mcptest_completions mcptest
`;
}

/**
 * Generate zsh completion script (placeholder)
 */
function generateZshCompletion(): string {
  return `# mcptest zsh completion
# Coming soon in future version

echo "Zsh completion not yet available. Use bash completion for now:"
echo "  mcptest completion bash > ~/.mcptest-completion.bash"
`;
}

/**
 * Generate fish completion script (placeholder)
 */
function generateFishCompletion(): string {
  return `# mcptest fish completion
# Coming soon in future version

echo "Fish completion not yet available. Use bash completion for now:"
echo "  mcptest completion bash > ~/.mcptest-completion.bash"
`;
}

/**
 * Show installation instructions
 */
function showInstructions(shell: string): void {
  console.error(`\n${GREEN}${BOLD}Installation Instructions${RESET}\n`);
  
  if (shell === 'bash') {
    console.error(`${YELLOW}1. Generate completion script:${RESET}`);
    console.error(`   ${CYAN}mcptest completion bash > ~/.mcptest-completion.bash${RESET}\n`);
    
    console.error(`${YELLOW}2. Add to your ~/.bashrc:${RESET}`);
    console.error(`   ${CYAN}echo 'source ~/.mcptest-completion.bash' >> ~/.bashrc${RESET}\n`);
    
    console.error(`${YELLOW}3. Reload your shell:${RESET}`);
    console.error(`   ${CYAN}source ~/.bashrc${RESET}\n`);
    
    console.error(`${YELLOW}4. Test completion:${RESET}`);
    console.error(`   ${CYAN}mcptest <TAB>              ${RESET}# Shows commands`);
    console.error(`   ${CYAN}mcptest run --<TAB>        ${RESET}# Shows run options`);
    console.error(`   ${CYAN}mcptest schema --<TAB>     ${RESET}# Shows schema options\n`);
  } else {
    console.error(`${YELLOW}${shell} completion coming in future version${RESET}\n`);
    console.error(`Use bash completion for now:`);
    console.error(`   ${CYAN}mcptest completion bash > ~/.mcptest-completion.bash${RESET}\n`);
  }
}

/**
 * Create completion command
 */
export function completionCommand(): Command {
  const cmd = new Command('completion');

  cmd
    .description('Generate shell completion scripts')
    .argument('<shell>', 'Shell type (bash, zsh, fish)')
    .option('--install', 'Show installation instructions')
    .action((shell: string, options: { install?: boolean }) => {
      try {
        // Validate shell
        const validShells = ['bash', 'zsh', 'fish'];
        if (!validShells.includes(shell)) {
          console.error(`\n❌ Error: Invalid shell "${shell}"`);
          console.error(`   Supported shells: ${validShells.join(', ')}\n`);
          process.exit(1);
        }

        // Show instructions if requested
        if (options.install) {
          showInstructions(shell);
          return;
        }

        // Generate completion script
        let script: string;
        switch (shell) {
          case 'bash':
            script = generateBashCompletion();
            break;
          case 'zsh':
            script = generateZshCompletion();
            break;
          case 'fish':
            script = generateFishCompletion();
            break;
          default:
            throw new Error(`Unsupported shell: ${shell}`);
        }

        // Output to stdout (for piping to file)
        console.log(script);

        // Show instructions to stderr (won't interfere with piping)
        if (shell === 'bash') {
          console.error(`\n${GREEN}✓${RESET} Bash completion script generated`);
          console.error(`\nTo install, run:`);
          console.error(`  ${CYAN}mcptest completion bash > ~/.mcptest-completion.bash${RESET}`);
          console.error(`  ${CYAN}echo 'source ~/.mcptest-completion.bash' >> ~/.bashrc${RESET}`);
          console.error(`  ${CYAN}source ~/.bashrc${RESET}\n`);
          console.error(`Or use: ${CYAN}mcptest completion bash --install${RESET}\n`);
        }
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
