const os = require('os');
const { createLogger } = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.logger = createLogger('performance');
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      requestsPerSecond: 0,
      responseTime: 0
    };
    this.requestCounter = 0;
    this.lastResetTime = Date.now();
    this.responseTimes = [];
  }

  // Get current server load
  getServerLoad() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    // Get CPU load (simplified)
    const loadAverage = os.loadavg()[0]; // 1-minute load average
    const cpuCount = os.cpus().length;
    const cpuUsage = (loadAverage / cpuCount) * 100;

    this.metrics.cpuUsage = Math.min(cpuUsage, 100);
    this.metrics.memoryUsage = memoryUsage;

    return {
      cpu: this.metrics.cpuUsage,
      memory: this.metrics.memoryUsage,
      load: Math.max(this.metrics.cpuUsage, this.metrics.memoryUsage) / 100
    };
  }

  // Track request
  trackRequest(req, res, next) {
    const startTime = Date.now();
    this.requestCounter++;

    // Calculate requests per second
    const now = Date.now();
    if (now - this.lastResetTime >= 1000) { // Reset every second
      this.metrics.requestsPerSecond = this.requestCounter;
      this.requestCounter = 0;
      this.lastResetTime = now;
    }

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);

      // Keep only last 100 response times for average calculation
      if (this.responseTimes.length > 100) {
        this.responseTimes = this.responseTimes.slice(-100);
      }

      this.metrics.responseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

      // Log slow requests
      if (responseTime > 5000) { // 5+ seconds
        this.logger.warn('Slow request detected', {
          url: req.originalUrl,
          method: req.method,
          responseTime: responseTime,
          userAgent: req.get('User-Agent')
        });
      }
    });

    next();
  }

  // Get current metrics
  getMetrics() {
    const serverLoad = this.getServerLoad();
    return {
      ...this.metrics,
      ...serverLoad,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  // Check if server is under high load
  isHighLoad() {
    const metrics = this.getMetrics();
    return metrics.load > 0.8 || metrics.cpu > 85 || metrics.memory > 85;
  }

  // Auto-scaling recommendations
  getScalingRecommendations() {
    const metrics = this.getMetrics();
    const recommendations = [];

    if (metrics.cpu > 80) {
      recommendations.push({
        type: 'cpu',
        severity: 'high',
        message: 'CPU usage is high. Consider adding more server instances.',
        value: metrics.cpu
      });
    }

    if (metrics.memory > 80) {
      recommendations.push({
        type: 'memory',
        severity: 'high',
        message: 'Memory usage is high. Consider increasing memory allocation.',
        value: metrics.memory
      });
    }

    if (metrics.responseTime > 2000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: 'Response times are slow. Consider optimizing queries or adding caching.',
        value: metrics.responseTime
      });
    }

    if (metrics.requestsPerSecond > 1000) {
      recommendations.push({
        type: 'load',
        severity: 'medium',
        message: 'High request volume. Consider implementing additional rate limiting.',
        value: metrics.requestsPerSecond
      });
    }

    return recommendations;
  }

  // Start periodic monitoring
  startMonitoring(intervalMs = 30000) { // 30 seconds
    setInterval(() => {
      const metrics = this.getMetrics();
      const recommendations = this.getScalingRecommendations();

      if (recommendations.length > 0) {
        this.logger.warn('Performance recommendations', {
          metrics,
          recommendations
        });
      }

      // Log metrics periodically
      this.logger.info('Performance metrics', metrics);
    }, intervalMs);
  }
}

module.exports = new PerformanceMonitor();
