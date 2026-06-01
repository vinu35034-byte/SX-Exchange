const { createLogger } = require('./logger');

const logger = createLogger('request-tracker');

/**
 * Simple request tracking middleware
 * Tracks requests and responses for basic metrics
 */
class RequestTracker {
  constructor() {
    this.metrics = {
      total: 0,
      success: 0,
      errors: 0
    };
  }

  track(req, res, next) {
    const originalSend = res.send;
    const originalJson = res.json;
    const tracker = this; // Store reference to tracker instance
    let responseSent = false; // Track if response has been sent
    
    res.send = function(data) {
      // Track the request using the tracker reference (only if not already sent)
      if (!responseSent && !res.headersSent) {
        responseSent = true;
        tracker.metrics.total++;
        if (res.statusCode < 400) {
          tracker.metrics.success++;
        } else {
          tracker.metrics.errors++;
        }
      }
      
      // Call original send with proper response context
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      // Track the request using the tracker reference (only if not already sent)
      if (!responseSent && !res.headersSent) {
        responseSent = true;
        tracker.metrics.total++;
        if (res.statusCode < 400) {
          tracker.metrics.success++;
        } else {
          tracker.metrics.errors++;
        }
      }
      
      // Call original json with proper response context
      return originalJson.call(this, data);
    };
    
    next();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  incrementRequest(success = true) {
    this.metrics.total++;
    if (success) {
      this.metrics.success++;
    } else {
      this.metrics.errors++;
    }
  }
}

const requestTracker = new RequestTracker();

module.exports = {
  trackRequest: requestTracker.track.bind(requestTracker),
  requestTracker
};
