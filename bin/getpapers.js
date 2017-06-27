#!/usr/bin/env node
var program = require('commander')
var fs = require('fs')
var log = require('winston')
var api = require('../lib/api.js')
var loglevels = require('../lib/loglevels.js')
var mkdirp = require('mkdirp')
var pjson = require('../package.json')

program
  .version(pjson.version)
  .option('-q, --query <query>',
    'search query (required)')
  .option('-o, --outdir <path>',
    'output directory (required - will be created if ' +
    'not found)')
  .option('--api <name>',
    'API to search [eupmc, crossref, ieee, arxiv] (default: eupmc)')
  .option('-x, --xml',
    'download fulltext XMLs if available')
  .option('-p, --pdf',
    'download fulltext PDFs if available')
  .option('-s, --supp',
    'download supplementary files if available')
  .option('-t, --minedterms',
    'download text-mined terms if available')
  .option('-l, --loglevel <level>',
    'amount of information to log ' +
    '(silent, verbose, info*, data, warn, error, or debug)',
    'info')
  .option('-a, --all',
    'search all papers, not just open access')
  .option('-n, --noexecute',
    "report how many results match the query, but don't actually " +
    'download anything')
  .option('-f, --logfile <filename>',
    'save log to specified file in output directory as well as printing to terminal')
  .option('-k, --limit <int>',
    'limit the number of hits and downloads')
  .option('--filter <filter object>',
    'filter by key value pair, passed straight to the crossref api only')
  .option('-r, --restart',
    'restart file downloads after failure')
  .parse(process.argv)

if (!process.argv.slice(2).length) {
  program.help()
}

if (!program.api) {
  program.api = 'eupmc'
}

// set up logging

var allowedlevels = Object.keys(loglevels.levels)
if (allowedlevels.indexOf(program.loglevel) === -1) {
  log.error('Loglevel must be one of: ',
    'quiet, verbose, data, info, warn, error, debug')
  process.exit(1)
}

log.addColors(loglevels.colors)
log.remove(log.transports.Console) // reset logger to nothing

log.add(log.transports.Console, {
  level: program.loglevel,
  levels: loglevels.levels,
  colorize: true
})

if (program.hasOwnProperty('logfile')) {
  var logstream = fs.createWriteStream(program.logfile.toString())
  log.add(log.transports.File, {
    stream: logstream,
    level: 'debug'
  })
  log.info('Saving logs to ./' + program.logfile)
}

// check arguments
if (typeof program.query === 'undefined' && program.api !== 'crossref') {
  log.error('No query given. ' +
    'You must provide the --query argument.')
  process.exit(1)
}

if (program.filter && program.api !== 'crossref') {
  log.warn('Filter given but not using CrossRef api ' +
    'so no filter applied.')
}

log.info('Searching using ' + program.api + ' API')

// run

var options = {}
options.xml = program.xml
options.pdf = program.pdf
options.supp = program.supp
options.minedterms = program.minedterms
options.restart = program.restart
options.all = program.all
options.hitlimit = parseInt(program.limit)
options.noexecute = program.noexecute
options.filter = program.filter

if (options.noexecute) {
  log.info('Running in no-execute mode, so nothing will be downloaded')
} else {
  if (!program.outdir) {
    log.error('No output directory given. ' +
      'You must provide the --outdir argument.')
    process.exit(1)
  }
  mkdirp.sync(program.outdir)
  process.chdir(program.outdir)
}

var Chosenapi = api(program.api)
var searchapi = new Chosenapi(options)
searchapi.search(program.query)
