/**
 * Real-Time Event Controller
 * Exposes Server-Sent Events (SSE) stream endpoint for live dashboard updates,
 * alerts, GPS pings, and delivery notifications with strict tenant isolation.
 */

const eventBus = require('../../../services/eventBus.service');

class EventController {
  /**
   * GET /api/v1/events/stream
   * Persistent SSE connection for authorized tenant clients
   */
  static stream(req, res) {
    const companyId = req.companyId || req.tenant?.companyId || req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Authentication and tenant context required for real-time event stream.'
      });
    }

    const tenantStr = companyId.toString();
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Set Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disables Nginx/Vercel proxy buffering
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // 1. Initial Connection Handshake
    const handshake = {
      subscriberId,
      companyId: tenantStr,
      connectedAt: new Date().toISOString(),
      status: 'CONNECTED',
      heartbeatIntervalMs: 20000
    };
    res.write(`event: connected\ndata: ${JSON.stringify(handshake)}\n\n`);

    // 2. Subscribe to Tenant Events
    const unsubscribe = eventBus.subscribe(tenantStr, (event) => {
      if (res.writableEnded || res.closed) return;
      res.write(`id: ${event.eventId}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    // 3. Heartbeat Ping every 20s to prevent TCP timeout
    const pingInterval = setInterval(() => {
      if (res.writableEnded || res.closed) {
        clearInterval(pingInterval);
        return;
      }
      res.write(`: ping ${Date.now()}\n\n`);
    }, 20000);

    // 4. Teardown on Client Disconnect
    const cleanup = () => {
      clearInterval(pingInterval);
      unsubscribe();
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    req.on('end', cleanup);
  }

  /**
   * GET /api/v1/events/status
   * Telemetry status check for the event subsystem
   */
  static getStatus(req, res) {
    const companyId = req.companyId || req.tenant?.companyId || req.user?.companyId;
    const activeSubscribers = companyId ? eventBus.getSubscriberCount(companyId) : 0;

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        transport: 'Server-Sent Events (SSE)',
        status: 'OPERATIONAL',
        activeSubscribers,
        tenantScoped: true,
        heartbeatSeconds: 20
      }
    });
  }
}

module.exports = EventController;
