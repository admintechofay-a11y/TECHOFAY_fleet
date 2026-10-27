/**
 * Telematics GPS Provider Interface
 * Defines standard abstraction for physical GPS hardware tracking integrations
 * (e.g. Government of India AIS-140 specification, Teltonika, Traccar, SIM tracking).
 */

class IGpsProvider {
  /**
   * Unique identifier of provider adapter
   * @returns {string} e.g. 'AIS140', 'TELTONIKA', 'TRACCAR', 'REST_PING'
   */
  getName() {
    throw new Error('IGpsProvider.getName must be implemented.');
  }

  /**
   * Returns whether required gateway credentials and hardware endpoints are configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('IGpsProvider.isConfigured must be implemented.');
  }

  /**
   * Returns current operational health status
   * @returns {{ status: 'CONFIGURED' | 'UNAVAILABLE', details: string }}
   */
  getStatus() {
    throw new Error('IGpsProvider.getStatus must be implemented.');
  }

  /**
   * Parses raw incoming telemetry stream or webhook payload
   * @param {Object|string} rawPayload
   * @param {Object} headers
   * @returns {{
   *   deviceId: string,
   *   latitude: number,
   *   longitude: number,
   *   speedKmph: number,
   *   headingDegrees: number,
   *   altitudeMeters: number,
   *   accuracyMeters: number,
   *   ignition: boolean,
   *   batteryPercent: number,
   *   timestamp: Date
   * }}
   */
  parsePing(rawPayload, headers) {
    throw new Error('IGpsProvider.parsePing must be implemented.');
  }

  /**
   * Validates hardware or webhook signature (e.g. HMAC-SHA256)
   * @param {Object|string} rawPayload
   * @param {string} signature
   * @param {string} secret
   * @returns {boolean}
   */
  verifySignature(rawPayload, signature, secret) {
    throw new Error('IGpsProvider.verifySignature must be implemented.');
  }
}

module.exports = IGpsProvider;
