 async function main() {
    const chunks = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const toolArgs = JSON.parse(Buffer.concat(chunks).toString());
    const input = toolArgs.tool_input || {};

    function isSensitivePath(p) {
      if (!p) return false;
      if (p.match(/\.tfvars$/) && !p.match(/\.tfvars\.example$/)) return true;
      if (p.match(/private.*\.pem$/i) || p.match(/\.pem.*private/i)) return
  true;
      return false;
    }

    // Read / Edit / Grep — check file_path directly
    const filePath = input.file_path || input.path || '';
    if (isSensitivePath(filePath)) {
      console.error(`Blocked: "${filePath}" may contain secrets and cannot be
  read or edited.`);
      process.exit(2);
    }

    // Bash — scan the full command string for any sensitive file references
    const command = input.command || '';
    if (command) {
      const tokens = command.split(/[\s'"]+/);
      for (const token of tokens) {
        if (isSensitivePath(token)) {
          console.error(`Blocked: command references "${token}" which may
  contain secrets.`);
          process.exit(2);
        }
      }
    }
  }

  main();