var fs = require('fs')
var chalk = require('chalk')
var ProgressBar = require('progress')
var request = require('requestretry')
var urlDl = require('./download.js')
var config = require('./config.js')
var log = require('winston')

var parseString = require('xml2js').parseString

var ArXiv = function (opts) {
  this.baseurl = 'http://export.arxiv.org/api/query?search_query='

  this.opts = opts
}

ArXiv.prototype.search = function (query) {
  var arxiv = this

  if (arxiv.opts.xml) {
    log.warn('The ArXiv API does not provide fulltext XML, so the --xml flag will be ignored')
  }

  if (arxiv.opts.minedterms) {
    log.warn('The ArXiv API does not provide mined terms so the --minedterms flag will be ignored')
  }

  var options = {}

  arxiv.queryurl = arxiv.buildQuery(query, options)
  arxiv.first = true
  arxiv.hitlimit = arxiv.opts.hitlimit ? arxiv.opts.hitlimit : 0
  arxiv.hitcount = 0
  arxiv.residualhits = 0
  arxiv.allresults = []
  arxiv.iter = 0
  arxiv.pagesize = 500
  arxiv.page_delay = 3000 // miliseconds to wait between requests
  arxiv.pageQuery()
}

ArXiv.prototype.pageQuery = function () {
  var arxiv = this

  var thisQueryUrl = arxiv.queryurl

  var pageterm =
    '&start=' + arxiv.iter +
    '&max_results=' + arxiv.pagesize
  thisQueryUrl += pageterm

  log.debug(thisQueryUrl)
  var rq = request.get({url: thisQueryUrl,
    headers: {'User-Agent': config.userAgent}})
  var convertXML2JSON = function (data) {
    // console.log(data.body)
    parseString(data.body, function (err, datum) {
      if (err) throw err
      var cb = arxiv.completeCallback.bind(arxiv, datum)
      cb()
    })
  }
  rq.on('complete', convertXML2JSON)
  rq.on('timeout', arxiv.timeoutCallback)
}

ArXiv.prototype.completeCallback = function (data) {
  var arxiv = this

  var totalfound = parseInt(data.feed['opensearch:totalResults'][0]._)

  if (arxiv.first) {
    arxiv.first = false
    arxiv.hitcount = totalfound
    log.info('Found ' + arxiv.hitcount + ' results')
    if (arxiv.hitcount === 0 || arxiv.opts.noexecute) {
      process.exit(0)
    }

    // set hitlimit
    if (arxiv.hitlimit && arxiv.hitlimit < arxiv.hitcount) {
      log.info('Limiting to ' + arxiv.hitlimit + ' hits')
    } else { arxiv.hitlimit = arxiv.hitcount }

    // create progress bar
    var progmsg = 'Retrieving results [:bar] :percent' +
                  ' (eta :etas)'
    var progopts = {
      total: arxiv.hitlimit,
      width: 30,
      complete: chalk.green('=')
    }
    arxiv.pageprogress = new ProgressBar(progmsg, progopts)
  }

  if (data && data.feed && data.feed.entry) {
    var result
    if (!arxiv.residualhits) { result = data.feed.entry } else { result = data.feed.entry.slice(0, arxiv.hitlimit) }
  } else {
    log.error('Malformed response from arXiv API - no data in feed')
    log.debug(data)
    log.info('Retrying failed request')
    setTimeout(arxiv.pageQuery.bind(arxiv), arxiv.page_delay)
    return
  }
  log.debug('Got', result.length, 'results in this page')
  arxiv.allresults = arxiv.allresults.concat(result)
  arxiv.pageprogress.tick(result.length)

  if (arxiv.allresults.length < arxiv.hitlimit) {
    arxiv.iter += arxiv.pagesize
    var hitsremaining = arxiv.hitlimit - arxiv.allresults.length
    if (hitsremaining < arxiv.pagesize) {
      arxiv.residualhits = hitsremaining
    }
    setTimeout(arxiv.pageQuery.bind(arxiv), arxiv.page_delay)
  } else {
    log.info('Done collecting results')
    arxiv.handleSearchResults(arxiv)
  }
}

ArXiv.prototype.handleSearchResults = function (arxiv) {
  // write the full result set to a file
  log.info('Saving result metadata')
  var pretty = JSON.stringify(arxiv.allresults, null, 2)
  fs.writeFileSync('arxiv_results.json', pretty)
  var filename = chalk.blue('arxiv_results.json')
  log.info('Full ArXiv result metadata written to ' + filename)

  var dlTasks = []

  // download the fullText PDF
  if (arxiv.opts.pdf) {
    dlTasks.push(arxiv.downloadFulltextPDFs)
  }

  // download the supplementary files
  if (arxiv.opts.supp) {
    dlTasks.push(arxiv.downloadSuppFiles)
  }

  arxiv.runDlTasks(dlTasks)
}

ArXiv.prototype.runDlTasks = function (dlTasks) {
  var arxiv = this

  arxiv.dlTasks = dlTasks
  arxiv.currDlTask = -1
  arxiv.nextDlTask()
}

ArXiv.prototype.nextDlTask = function () {
  var arxiv = this

  arxiv.currDlTask ++
  if (arxiv.dlTasks.length > arxiv.currDlTask) {
    var fun = arxiv.dlTasks[arxiv.currDlTask]
    fun(arxiv)
  } else {
    process.exit(0)
  }
}

ArXiv.prototype.timeoutCallback = function (ms) {
  log.error('Did not get a response from the ArXiv API within ' + ms + 'ms')
}

ArXiv.prototype.buildQuery = function (query, options) {
  var arxiv = this

  var queryurl = arxiv.baseurl + encodeURIComponent(query)

  Object.keys(options).forEach(function (key) {
    var val = options[key]
    if (key.length > 0) {
      queryurl += '&' + key + '=' + val
    }
  })

  return queryurl
}

ArXiv.prototype.getFulltextPDFUrl = function (result) {
  var urls = result.link
  var pdfurls = urls.filter(function (u) {
    return u['$'].type === 'application/pdf'
  })

  if (pdfurls.length === 0) {
    // log.info('pdf missing')
    return null
  } else {
    return [ pdfurls[0]['$'].href, result.id[0].split('abs/')[1] + '/' ]
  }
}

ArXiv.prototype.getIdentifier = function (result) {
  return result.id[0]
}

ArXiv.prototype.getSuppFilesUrl = function (result) {
  var arxiv = this

  var id = arxiv.getIdentifier(result)

  return [id.split('abs').join('e-print'), id.split('abs/')[1]]
}

ArXiv.prototype.urlQueueBuilder = function (urls, type, rename) {
  return urls.map(function urlQueueBuilder (urlId) {
    return { url: urlId[0], id: urlId[1], type: type, rename: rename }
  })
}

ArXiv.prototype.downloadFulltextPDFs = function (arxiv) {
  var urls = arxiv.allresults
    .map(arxiv.getFulltextPDFUrl, arxiv)
    .filter(function (x) { return !(x === null) })

  log.info('Downloading fulltext PDF files')

  var urlQueue = arxiv.urlQueueBuilder(urls, 'PDF', 'fulltext.pdf')
  urlDl.downloadurlQueue(urlQueue, arxiv.nextDlTask.bind(arxiv))
}

ArXiv.prototype.downloadSuppFiles = function (arxiv) {
  var urls = arxiv.allresults
    .map(arxiv.getSuppFilesUrl, arxiv)
    .filter(function (x) { return !(x === null) })

  log.info('Downloading supplementary files')

  var urlQueue = arxiv.urlQueueBuilder(urls, 'supplementary files', 'supplementaryFiles.tar.gz')
  urlDl.downloadurlQueue(urlQueue, arxiv.nextDlTask.bind(arxiv))
}

module.exports = ArXiv
