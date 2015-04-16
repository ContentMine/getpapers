#!/usr/bin/env node
var program = require('commander')
, fs = require('fs')
, winston = require('winston')
, EuPmc = require('../lib/eupmc.js')
, loglevels = require('../lib/loglevels.js')
, mkdirp = require('mkdirp');

var pjson = require('../package.json');

program
.version(pjson.version)
.option('-q, --query <query>',
        'Search query (required)')
.option('-o, --outdir <path>',
        'Output directory (required - will be created if ' +
        'not found)')
.option('-x, --xml',
        'Download fulltext XMLs if available')
.option('-p, --pdf',
        'Download fulltext PDFs if available')
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

// check arguments

if (!program.query) {
  log.error('No query given. ' +
            'You must provide the --query argument.');
  process.exit(1);
}

if (!program.outdir) {
  log.error('No output directory given. ' +
            'You must provide the --outdir argument.');
  process.exit(1);
}

// run

var options = {}
options.xml = program.xml
options.pdf = program.pdf

mkdirp.sync(program.outdir);
process.chdir(program.outdir);
var eupmc = new EuPmc(options);
eupmc.search(program.query);
