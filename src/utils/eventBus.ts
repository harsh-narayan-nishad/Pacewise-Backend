import { EventEmitter } from "node:events";

/**
 * Purely local, in-process fan-out from "a Redis pub/sub message arrived"
 * to "every SSE connection this one instance is currently holding open"
 * (see modules/notifications/notifications.controller.ts's `stream`).
 * This does NOT replace Redis pub/sub — it's the last hop after it. Redis
 * is what gets the event from whichever instance created it to every
 * instance; this EventEmitter is what gets it from "this instance
 * received it" to "the right client, connected to this instance, sees
 * it."
 */
export const localEventBus = new EventEmitter();
localEventBus.setMaxListeners(0); // many concurrent SSE connections is expected, not a leak
