import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logGroupName = '/containers/trivia';
const region = process.env.AWS_REGION || 'us-east-1';

// Create Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Configure transport based on environment
  transport: isProduction ? {
    target: '@serdnam/pino-cloudwatch-transport',
    options: {
      logGroupName,
      logStreamName: `app-${new Date().toISOString().split('T')[0]}`, // Daily log streams
      awsRegion: region,
      interval: 1000, // Batch logs every 1 second
    }
  } : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    }
  }
});

export default logger;

// Helper to create child loggers with context
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}
