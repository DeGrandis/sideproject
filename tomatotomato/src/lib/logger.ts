import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logGroupName = '/containers/tomatotomato';

// Log which mode we're in on startup
console.log(`[Logger Init] Environment: ${process.env.NODE_ENV}, Production: ${isProduction}`);

// In production, output JSON to stdout (Docker awslogs captures it)
// In development, use pretty printing
const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  base: {
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pretty print only in development
  transport: !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    }
  } : undefined // Production: output JSON to stdout, Docker awslogs handles CloudWatch
});

// Log successful initialization
logger.info({ 
  isProduction, 
  logDestination: isProduction ? 'stdout -> Docker awslogs -> CloudWatch' : 'console (pretty)',
  logGroupName: isProduction ? logGroupName : 'n/a'
}, 'Logger initialized');

export default logger;

// Helper to create child loggers with context
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}
