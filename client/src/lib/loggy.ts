import { trpc } from "./trpc";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * "loggy" - The centralized client-side logger.
 * Sends detailed application logs to the server.
 */
class Loggy {
    private async send(level: LogLevel, category: string, message: string, metadata?: any) {
        try {
            // We use a raw fetch or direct tRPC call if possible.
            // To avoid circular dependencies and ensure logs are sent even if the app state is unstable,
            // we use the trpc client directly.
            await (trpc as any).system.addLog.mutate({
                level,
                category,
                message,
                metadata: metadata ? JSON.stringify(metadata) : undefined
            });
        } catch (err) {
            // Fallback to console if server logging fails
            console.error("[loggy] Failed to send log to server:", err);
        }
    }

    info(category: string, message: string, metadata?: any) {
        console.info(`[${category}] ${message}`, metadata);
        this.send('info', category, message, metadata);
    }

    warn(category: string, message: string, metadata?: any) {
        console.warn(`[${category}] ${message}`, metadata);
        this.send('warn', category, message, metadata);
    }

    error(category: string, message: string, metadata?: any) {
        console.error(`[${category}] ${message}`, metadata);
        this.send('error', category, message, metadata);
    }

    debug(category: string, message: string, metadata?: any) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[${category}] ${message}`, metadata);
        }
        this.send('debug', category, message, metadata);
    }
}

export const loggy = new Loggy();
