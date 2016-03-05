#!/usr/bin/env node
var program = require('commander')
, fs = require('fs')
, winston = require('winston')
, api = require('../lib/api.js')
, loglevels = require('../lib/loglevels.js')
, mkdirp = require('mkdirp');

var pjson = require('../package.json');

program
.version(pjson.version)
.option('-q, --query <query>',
        'search query (required)')
.option('-o, --outdir <path>',
        'output directory (required - will be created if ' +
        'not found)')
.option('--api <name>',
        'API to search [eupmc, ieee, arxiv] (default: eupmc)')
.option('-x, --xml',
        'download fulltext XMLs if available')
.option('-p, --pdf',
        'download fulltext PDFs if available')
.option('-s, --supp',
        'download supplementary files if available')
.option('-l, --loglevel <level>',
        'amount of information to log ' +
        '(silent, verbose, info*, data, warn, error, or debug)',
        'info')
.option('-a, --all',
        'search all papers, not just open access')
.option('-n, --noexecute',
        'report how many results match the query, but don\'t actually ' +
        'download anything')
.option('-f, --logfile <filename>',
        'save log to specified file in output directory as well as printing to terminal')
.option('-k, --limit <int>',
	'limit the number of hits and downloads')
.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}

if (!program.api) {
  program.api = 'eupmc';
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

if (program.hasOwnProperty('logfile')) {
  log.add(winston.transports.File, {
    filename: program.logfile,
    level: 'debug'
  });
  log.info('Saving logs to ./' + program.outdir + '/' + program.logfile);
}

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

log.info('Searching using ' + program.api + ' API');

// run

var options = {}
options.xml = program.xml;
options.pdf = program.pdf;
options.supp = program.supp;
options.all = program.all;
options.hitlimit = parseInt(program.limit);
options.noexecute = program.noexecute;
if (options.noexecute) {
  log.info('Running in no-execute mode, so nothing will be downloaded');
}

mkdirp.sync(program.outdir);
process.chdir(program.outdir);
var chosenapi = api(program.api);
var searchapi = new chosenapi(options);
searchapi.search(program.query);
