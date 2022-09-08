const winston = require("winston");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.printf(({ level, message, label, timestamp }) => {
    return `${new Date(timestamp).toISOString()} [${label}] ${level}: ${message}`;
  }),
  defaultMeta: { service: "dummy-c-worker" },
  transports: [
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

module.exports = {
  log: function (status, msg) {
    logger.log({
      level: 'info',
      timestamp: Date.now(),
      label: status,
      message: msg
    });
  },
};
