
import { spawn } from 'child_process';

const push = spawn('npx', ['drizzle-kit', 'push'], {
    shell: true,
    env: process.env
});

push.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    // Column rename/create prompts
    if (output.includes('created or renamed')) {
        push.stdin.write('\n');
    }

    // Table rename prompt
    if (output.includes('rename table')) {
        push.stdin.write('\n');
    }

    // Confirmation prompts
    if (output.includes('Warning') || output.includes('data-loss') || output.includes('Are you sure')) {
        push.stdin.write('y\n');
    }
});

push.stderr.on('data', (data) => {
    console.error(data.toString());
});

push.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});
