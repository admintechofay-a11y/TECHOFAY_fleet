/**
 * Real-time In-Memory Tenant Event Bus Service
 * Distributes real-time events for Server-Sent Events (SSE) and WebSocket push
 * with strict tenant isolation, monotonic ordering, and disconnect cleanup.
 */

const EventEmitter = require('events');

class EventBusService {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(500); // Support high client concurrency
    this._sequence = 0;
  }

  /**
   * Formats tenant channel key
   * @private
   */
  _getChannel(companyId) {
    if (!companyId) throw new Error('companyId is required for tenant event channel.');
    return `tenant:${companyId.toString()}`;
  }

  /**
   * Generates a collision-safe, monotonically incremented event ID
   * @private
   */
  _nextEventId() {
    this._sequence = (this._sequence + 1) % Number.MAX_SAFE_INTEGER;
    return `evt_${Date.now()}_${this._sequence}`;
  }

  /**
   * Publishes an event strictly scoped to a tenant
   * @param {string|ObjectId} companyId Tenant organization identifier
   * @param {string} eventType High-level event identifier (e.g. TRIP_DISPATCHED, LOAD_CREATED)
   * @param {Object} payload Event details
   * @returns {Object} The published event object
   */
  publish(companyId, eventType, payload = {}) {
    if (!companyId) {
      console.warn('[EVENT_BUS] Dropping event without companyId:', eventType);
      return null;
    }

    const eventId = this._nextEventId();
    const event = {
      id: eventId,
      eventId,
      eventType,
      companyId: companyId.toString(),
      timestamp: new Date().toISOString(),
      payload
    };

    const channel = this._getChannel(companyId);
    this._emitter.emit(channel, event);
    this._emitter.emit('__wildcard__', event); // For audit/testing

    return event;
  }

  /**
   * Subscribes a listener to a specific tenant channel
   * @param {string|ObjectId} companyId Tenant organization identifier
   * @param {Function} handler Callback receiving the event object
   * @returns {Function} Unsubscribe function
   */
  subscribe(companyId, handler) {
    const channel = this._getChannel(companyId);

    const safeHandler = (event) => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[EVENT_BUS] Error in event listener for ${channel}:`, err);
      }
    };

    this._emitter.on(channel, safeHandler);

    return () => {
      this._emitter.removeListener(channel, safeHandler);
    };
  }

  /**
   * Subscribes to all events (strictly for testing and audit logs)
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  subscribeAll(handler) {
    const safeHandler = (event) => {
      try {
        handler(event);
      } catch (err) {
        console.error('[EVENT_BUS] Error in wildcard event listener:', err);
      }
    };

    this._emitter.on('__wildcard__', safeHandler);

    return () => {
      this._emitter.removeListener('__wildcard__', safeHandler);
    };
  }

  /**
   * Returns active listener count for a tenant channel
   * @param {string|ObjectId} companyId
   * @returns {number}
   */
  getSubscriberCount(companyId) {
    const channel = this._getChannel(companyId);
    return this._emitter.listenerCount(channel);
  }

  /**
   * Cleans all active listeners (useful in test teardowns)
   */
  clearAllListeners() {
    this._emitter.removeAllListeners();
  }
}

module.exports = new EventBusService();
