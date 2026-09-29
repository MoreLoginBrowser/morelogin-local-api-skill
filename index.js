#!/usr/bin/env node

/**
 * Optional Node entrypoint. Does not register any third-party agent command.
 */

const { main } = require('./bin/morelogin');

if (require.main === module) main(process.argv.slice(2));
module.exports = { main };
