const fs = require('fs').promises;
const path = require('path');
const mustache = require('mustache');// HTML Template Rendering we use 
const juice = require('juice');

const templatesDir = path.join(__dirname, '../emailTemplates');

exports.renderTemplate = async (templateName, data) => { 
  try {
     
    let layoutHtml, contentHtml;
    try {
        layoutHtml = await fs.readFile(path.join(templatesDir, 'layout.html'), 'utf-8');
        contentHtml = await fs.readFile(path.join(templatesDir, templateName), 'utf-8');
    } catch (readError) {
        console.error(`CRITICAL ERROR: Could not read template files.`, readError);
        throw new Error(`Template file not found: ${templateName}`);
    }
 
    const renderedBody = mustache.render(contentHtml, data);
    const layoutData = {
      ...data,
      body: renderedBody,
      currentYear: new Date().getFullYear(),
      showContainer: data.showContainer !== false, 
      isShowHeader: data.isShowHeader !== false,
      isShowFooter: data.isShowFooter !== false,
    }; 
    const finalHtml = mustache.render(layoutHtml, layoutData); 
    const inlinedHtml = juice(finalHtml); 
    return inlinedHtml;

  } catch (error) { 
    console.error(`CATASTROPHIC ERROR IN TEMPLATE SERVICE`);
    console.error(error);
    // Return a visible error message instead of a blank email body
    return `<h1 style="color: red;">Error: Could not generate email template.</h1><pre>${error.stack}</pre>`;
  }
};