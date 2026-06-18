'use strict';
// FR : Application Express : middlewares, montage des routes, gestion d'erreurs.
// EN : Express app: middlewares, route mounting, error handling.

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.security.corsOrigin === '*' ? true : config.security.corsOrigin.split(','),
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '1mb',
    // Keep the raw body so webhook HMAC signatures can be verified.
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));

// Mount API under the configured prefix, behind the global rate limiter.
app.use(config.apiPrefix, apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
