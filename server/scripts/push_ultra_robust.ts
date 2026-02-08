
import { spawn } from 'child_process';

console.log('Starting automated push to PRODUCTION...');
const push = spawn('npx', ['drizzle-kit', 'push'], {
    shell: true,
    env: process.env
});

push.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('STDOUT:', output);

    // Column conflict prompts
    if (output.includes('created or renamed')) {
        console.log('--- Responding to column conflict with ENTER (Create) ---');
        push.stdin.write('\n');
    }

    // Table rename prompt
    if (output.includes('push_subscriptions') && output.includes('pushSubscriptions')) {
        console.log('--- Responding to table rename with ENTER (Yes) ---');
        push.stdin.write('\n');
    }

    // Confirmation prompts
    if (output.includes('Warning') || output.includes('data-loss') || output.includes('Are you sure')) {
        console.log('--- Responding to confirmation with "y" ---');
        push.stdin.write('y\n');
    }

    // Final apply prompt
    if (output.includes('apply')) {
        console.log('--- Responding to final apply with "y" ---');
        push.stdin.write('y\n');
    }
});

push.stderr.on('data', (data) => {
    console.error('STDERR:', data.toString());
});

push.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});
