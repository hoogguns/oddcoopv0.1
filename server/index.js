/**
 * server/index.js — backward-compatibility shim.
 *
 * The canonical entry point is now `server.js` at the project root.
 * This file re-exports everything from that module so any code that does:
 *
 *   require('./server/index')
 *   require('../index')           ← from within server/
 *
 * continues to work without changes during the migration.
 *
 * @deprecated Use `server.js` directly.
 */
'use strict';

module.exports = require('../server');
