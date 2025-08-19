const nodemailer = require('nodemailer');
const logger = require('./logger');
 
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",  
    port: 465,  
    secure: true,  
    auth: {
        user: "ajitoff875@gmail.com",
        pass: "tkrd lsne difu giwk"
    }
});

/**
 * Send email with required and optional fields
 * @param {Object} data - Email fields (from, to, subject, html, text, etc.)
 * @param {String} source - Controller/service name for debug
 */
exports.sendMail = async (data, source = 'unknown') => {
    const requiredFields = ['from', 'to', 'subject'];

    const missing = requiredFields.filter(field => !data[field]);

    if (missing.length > 0) {
        const errorMsg = `  Missing required email fields: ${missing.join(', ')}`;
        logger.logError(`Mailer Error in ${source}`, new Error(errorMsg));
        throw new Error(errorMsg);
    }
 
    try {
        const info = await transporter.sendMail(data);
        logger.logInfo(` Email sent from ${data.from} to ${data.to} (controller: ${source})`);
        return info;
    } catch (err) {
        logger.logError(`  Email failed in ${source}`, err);
        throw err;
    }
};
