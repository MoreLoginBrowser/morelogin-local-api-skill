#!/usr/bin/env node
const { main } = require('./morelogin');

const incoming = process.argv.slice(2);
const args = ['cloudphone', ...(incoming.length > 0 ? incoming : ['help'])];
main(args);
