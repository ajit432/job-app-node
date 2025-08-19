const fs = require('fs');
const path = require('path');
const logDir = path.join(__dirname, '../../logs');
const logPath = path.join(logDir, 'error.log');

 
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const stream = fs.createWriteStream(logPath, { flags: 'a' });

module.exports = {
    stream,
    logError: (err) => {
        const errorText = `[${new Date().toISOString()}] ${err.stack || err}\n`;
        stream.write(errorText);
        console.error(`[${new Date().toISOString()}] ERROR:`, err);
    },
    logInfo: (msg) => {
        const infoText = `[${new Date().toISOString()}] INFO: ${msg}\n`;
        stream.write(infoText);
        console.info(`[${new Date().toISOString()}] INFO:`, msg);
    },
    info: (msg) => {
        const infoText = `[${new Date().toISOString()}] INFO: ${msg}\n`;
        stream.write(infoText);
        console.info(`[${new Date().toISOString()}] INFO:`, msg);
    },
    error: (err) => {
        const errorText = `[${new Date().toISOString()}] ${err.stack || err}\n`;
        stream.write(errorText);
        console.error(`[${new Date().toISOString()}] ERROR:`, err);
    }
};
