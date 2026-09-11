import readline from "node:readline";

/**
 * Reads one line from the terminal, optionally without echoing it (PIN-0014).
 *
 * Hidden input matters here for a reason beyond shoulder-surfing: a secret typed as a shell
 * argument lands in `~/.zsh_history` and in the process list. Prompting keeps it out of both.
 *
 * `_writeToOutput` is readline's private hook for exactly this; there is no public API for a
 * masked prompt in Node.
 */
export function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      rl._writeToOutput = (chunk) => {
        // Echo the question itself, swallow whatever is typed after it.
        if (chunk.includes(question)) rl.output.write(question);
      };
    }

    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}
