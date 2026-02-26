type EventHandler<T = any> = (payload: T) => Promise<void> | void;

export class EventBus {
  private static instance: EventBus;
  private handlers: Map<string, EventHandler[]> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    const currentHandlers = this.handlers.get(eventType) || [];
    currentHandlers.push(handler);
    this.handlers.set(eventType, currentHandlers);
  }

  public async publish<T>(eventType: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      await Promise.all(handlers.map(handler => handler(payload)));
    }
  }
}

export const eventBus = EventBus.getInstance();
