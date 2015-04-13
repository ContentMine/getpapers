#!/usr/bin/env node
var program = require('commander')
, fs = require('fs')
, winston = require('winston')
, eupmc = require('../lib/eupmc.js')
, loglevels = require('../lib/loglevels.js');

var pjson = require('../package.json');

program
.version(pjson.version)
.option('-q, --query <query>',
'Search query')
.option('-l, --loglevel <level>',
'amount of information to log ' +
'(silent, verbose, info*, data, warn, error, or debug)',
'info')
.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}

// set up logging
var allowedlevels = Object.keys(loglevels.levels);
if (allowedlevels.indexOf(program.loglevel) == -1) {
  winston.error('Loglevel must be one of: ',
  'quiet, verbose, data, info, warn, error, debug');
  process.exit(1);
}

log = new (winston.Logger)({
  transports: [new winston.transports.Console({
    level: program.loglevel,
    levels: loglevels.levels,
    colorize: true
  })],
  level: program.loglevel,
  levels: loglevels.levels,
  colorize: true
});
winston.addColors(loglevels.colors);

eupmc.search(program.query);
