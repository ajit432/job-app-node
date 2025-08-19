// It Help To The Dynamic Routing the File
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const routesPath = path.join(__dirname);

fs.readdirSync(routesPath).forEach((file) => {
    if (file.endsWith('.routes.js')) {
        const routeModule = require(path.join(routesPath, file));
        const routeName = file.replace('.routes.js', '');
        router.use(`/${routeName}`, routeModule);
    }
});

module.exports = router;
