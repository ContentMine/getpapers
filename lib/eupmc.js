var fs = require('fs')
var chalk = require('chalk')
var got = require('got')
var mkdirp = require('mkdirp')
var _ = require('lodash')
var ProgressBar = require('progress')
var urlDl = require('./download.js')
var requestretry = require('requestretry')
var glob = require('matched')
var vc = require('version_compare')
var config = require('./config.js')
var log = require('winston')

var parseString = require('xml2js').parseString

var EuPMCVersion = '5.3.2'

var EuPmc = function (opts) {
  var eupmc = this
  this.baseurl = 'https://www.ebi.ac.uk/' +
                 'europepmc/webservices/rest/search?'
  this.opts = opts || {}
  eupmc.first = true
  eupmc.hitlimit = eupmc.opts.hitlimit ? eupmc.opts.hitlimit : 0
  eupmc.hitcount = 0
  eupmc.residualhits = 0
  eupmc.allresults = []
  eupmc.nextCursorMark = '*' // we always get back the first page
  eupmc.pagesize = '1000'
  eupmc.unfillledPage = false
}

EuPmc.prototype.search = function (query) {
  var eupmc = this

  if (!eupmc.opts.all) {
    query += ' OPEN_ACCESS:y'
  }
  var options = { resulttype: 'core', pageSize: eupmc.pagesize }
  eupmc.queryurl = eupmc.buildQuery(query, options)

  if (eupmc.opts.restart) {
    fs.readFile('eupmc_results.json', (err, data) => {
      if ((err) && (err.code === 'ENOENT')) {
        log.error('No existing download to restart')
        process.exit(1)
      } else if (err) {
        throw err
      } else {
        log.info('Restarting previous download')
        eupmc.allresults = JSON.parse(data)
        eupmc.addDlTasks()
      }
    })
  } else {
    eupmc.pageQuery()
  }
}

EuPmc.prototype.testApi = function (version) {
  if (!vc.matches(version, EuPMCVersion)) {
    log.warn('This version of getpapers wasn\'t built with this version of the EuPMC api in mind')
    log.warn(`getpapers EuPMCVersion: ${EuPMCVersion} vs. ${version} reported by api`)
  }
}

EuPmc.prototype.pageQuery = function () {
  var eupmc = this

  var thisQueryUrl = eupmc.queryurl + ''

  var pageterm = '&cursorMark=' + eupmc.nextCursorMark
  thisQueryUrl += pageterm

  log.debug(thisQueryUrl)

  var retryOnHTTPNetOrEuPMCFailure = function (err, response, body) {
    return requestretry.RetryStrategies.HTTPOrNetworkError(err, response, body) ||
            ~body.indexOf('<resultList/>') // hacky way to see if resultsList is empty
  }

  var rq = requestretry.get({url: thisQueryUrl,
    maxAttempts: 10,
    retryStrategy: retryOnHTTPNetOrEuPMCFailure,
    headers: {'User-Agent': config.userAgent}
  })
  var handleResquestResponse = function (data) {
    if (data.attempts > 1) {
      log.warn('We had to retry the last request ' + data.attempts + ' times.')
    }
    convertXML2JSON(data)
  }
  var convertXML2JSON = function (data) {
    parseString(data.body, function (err, datum) {
      if (err) throw err
      var cb = eupmc.completeCallback.bind(eupmc, datum)
      cb()
    })
  }
  rq.then(handleResquestResponse)
  rq.on('timeout', eupmc.timeoutCallback)
}

EuPmc.prototype.completeCallback = function (data) {
  var eupmc = this

  var resp = data.responseWrapper

  if (!resp.hitCount || !resp.hitCount[0] || !resp.resultList[0].result) {
    log.error('Malformed or empty response from EuropePMC. Try running again. Perhaps your query is wrong.')
    process.exit(1)
  }

  if (eupmc.first) {
    eupmc.first = false
    eupmc.hitcount = parseInt(resp.hitCount[0])
    var oaclause = eupmc.opts.all ? '' : ' open access'
    log.info('Found ' + eupmc.hitcount + oaclause + ' results')

    eupmc.testApi(resp.version[0])

    if (eupmc.hitcount === 0 || eupmc.opts.noexecute) {
      process.exit(0)
    }

    // set hitlimit
    if (eupmc.hitlimit && eupmc.hitlimit < eupmc.hitcount) {
      log.info('Limiting to ' + eupmc.hitlimit + ' hits')
    } else { eupmc.hitlimit = eupmc.hitcount }

    // create progress bar
    var progmsg = 'Retrieving results [:bar] :percent' +
                  ' (eta :etas)'
    var progopts = {
      total: eupmc.hitlimit,
      width: 30,
      complete: chalk.green('=')
    }
    eupmc.pageprogress = new ProgressBar(progmsg, progopts)
  }
  var result
  if (eupmc.residualhits) {
    result = resp.resultList[0].result.slice(0, eupmc.residualhits)
  } else {
    result = resp.resultList[0].result
    // if less results in this page than page count (and we were expecting an entire page)
    // EuPMC has been lying and we shouldn't keep searching for more results
    if (result.length < eupmc.pagesize) eupmc.unfilledPage = true
  }
  log.debug('In this batch got: ' + result.length + ' results')
  eupmc.allresults = eupmc.allresults.concat(result)
  eupmc.pageprogress.tick(result.length)

  if (eupmc.allresults.length < eupmc.hitlimit) { // we still have more results to get
    if (eupmc.unfilledPage) { // but the last page wasn't full then something is wrong
      log.info('EuPMC gave us the wrong hitcount. We\'ve already found all the results')
      eupmc.handleSearchResults(eupmc)
      return
    }
    if (eupmc.hitlimit - eupmc.allresults.length < eupmc.pagesize) {
      eupmc.residualhits = eupmc.hitlimit - eupmc.allresults.length
    }
    eupmc.nextCursorMark = resp.nextCursorMark[0]
    eupmc.pageQuery()
  } else {
    log.info('Done collecting results')
    eupmc.handleSearchResults(eupmc)
  }
}

EuPmc.prototype.timeoutCallback = function (ms) {
  var eupmc = this
  log.error('Did not get a response from Europe PMC within ' + ms + 'ms')
  if (eupmc.allresults) {
    log.info('Handling the limited number of search results we got.')
    log.warn('The metadata download did not finish so you *will* be missing some results')
    eupmc.handleSearchResults(eupmc)
  }
}

EuPmc.prototype.buildQuery = function (query, options) {
  var eupmc = this

  var queryurl = eupmc.baseurl + 'query=' + encodeURIComponent(query)
  Object.keys(options).forEach(function (key) {
    var val = options[key]
    if (key.length > 0) {
      queryurl += '&' + key + '=' + val
    }
  })
  return queryurl
}

EuPmc.prototype.formatResult = function (result) {
  return result.authorString +
  ' (' + result.pubYear + '). ' +
  result.title + ' https://doi.org/' + result.DOI
}

EuPmc.prototype.handleSearchResults = function (eupmc) {
  // see how many results were unique
  var originalLength = eupmc.allresults.length
  eupmc.allresults = _.uniq(eupmc.allresults, function (x) {
    return eupmc.getIdentifier(x).id
  })
  if (eupmc.allresults.length < originalLength) {
    log.info('Duplicate records found: ' +
             eupmc.allresults.length +
             ' unique results identified')
  }

  if (eupmc.allresults.length > eupmc.hitlimit) {
    eupmc.allresults = eupmc.allresults.slice(0, eupmc.hitlimit)
    log.info('limiting hits')
  }

  // write the full result set to a file
  log.info('Saving result metadata')
  var pretty = JSON.stringify(eupmc.allresults, null, 2)
  fs.writeFileSync('eupmc_results.json', pretty)
  var resultsFilename = chalk.blue('eupmc_results.json')
  log.info('Full EUPMC result metadata written to ' + resultsFilename)

  // write individual results to their respective directories
  eupmc.allresults.forEach(function (result) {
    eupmc.writeRecord(result, eupmc)
  })
  log.info('Individual EUPMC result metadata records written')

  // write only the url list to file
  log.info('Extracting fulltext HTML URL list (may not be available for all articles)')
  var urls = eupmc.allresults
    .map(eupmc.getFulltextHTMLUrl, eupmc)
    .filter(function (x) { return !(x === null) })

  if (urls.length > 0) {
    fs.writeFileSync(
      'eupmc_fulltext_html_urls.txt',
      urls.concat(['\n']).join('\n')
    )
    var urlFilename = chalk.blue('eupmc_fulltext_html_urls.txt')
    log.info('Fulltext HTML URL list written to ' + urlFilename)
  }

  eupmc.addDlTasks()
}

EuPmc.prototype.addDlTasks = function () {
  var eupmc = this
  var dlTasks = []

  // download the fullText XML
  if (eupmc.opts.xml) {
    dlTasks.push(eupmc.downloadFulltextXMLs)
  }

  // download the fullText PDF
  if (eupmc.opts.pdf) {
    dlTasks.push(eupmc.downloadFulltextPDFs)
  }

  // download the supplementary files
  if (eupmc.opts.supp) {
    dlTasks.push(eupmc.downloadSuppFiles)
  }

  // download the supplementary files
  if (eupmc.opts.minedterms) {
    dlTasks.push(eupmc.downloadMinedTerms)
    dlTasks.push(eupmc.summariseMinedTerms)
  }

  eupmc.runDlTasks(dlTasks)
}

EuPmc.prototype.runDlTasks = function (dlTasks) {
  var eupmc = this

  eupmc.dlTasks = dlTasks
  eupmc.currDlTask = -1
  eupmc.nextDlTask()
}

EuPmc.prototype.nextDlTask = function () {
  var eupmc = this

  eupmc.currDlTask ++
  if (eupmc.dlTasks.length > eupmc.currDlTask) {
    var fun = eupmc.dlTasks[eupmc.currDlTask]
    fun(eupmc)
  } else {
    process.exit(0)
  }
}

EuPmc.prototype.downloadFulltextXMLs = function (eupmc) {
  var urls = eupmc.allresults
    .map(eupmc.getFulltextXMLUrl, eupmc)
    .filter(function (x) { return !(x === null) })

  log.info('Got XML URLs for ' + urls.length + ' out of ' + eupmc.allresults.length + ' results')

  log.info('Downloading fulltext XML files')

  var urlQueue = eupmc.urlQueueBuilder(urls, 'XML', 'fulltext.xml')
  urlDl.downloadurlQueue(urlQueue, eupmc.nextDlTask.bind(eupmc))
}

EuPmc.prototype.downloadMinedTerms = function (eupmc) {
  var urls = eupmc.allresults
    .map(eupmc.getMinedTermsURL, eupmc)
    .filter(function (x) { return !(x === null) })

  log.info('Got mined terms JSON URLs for ' + urls.length + ' out of ' + eupmc.allresults.length + ' results')

  log.info('Downloading mined terms JSON files')

  var urlQueue = eupmc.urlQueueBuilder(urls, 'JSON', 'textMinedTerms.json')
  urlDl.downloadurlQueue(urlQueue, eupmc.nextDlTask.bind(eupmc))
}

EuPmc.prototype.downloadFulltextPDFs = function (eupmc) {
  var urls = eupmc.allresults
    .map(eupmc.getFulltextPDFUrl, eupmc)
    .filter(function (x) { return !(x === null) })

  log.info('Downloading fulltext PDF files')

  var urlQueue = eupmc.urlQueueBuilder(urls, 'PDF', 'fulltext.pdf')
  urlDl.downloadurlQueue(urlQueue, eupmc.nextDlTask.bind(eupmc))
}

EuPmc.prototype.downloadSuppFiles = function (eupmc) {
  var urls = eupmc.allresults
    .map(eupmc.getSuppFilesUrl, eupmc)
    .filter(function (x) { return !(x === null) })

  log.info('Downloading supplementary files')

  var failed = []
  var retries = 0
  var missing = 0

  var fourohfour = function () {
    missing++
  }

  var done = _.after(urls.length, function () {
    if (failed.length > 0 && retries === 0) {
      log.warn(failed.length + ' downloads timed out. Retrying.')
      failed = []
      eupmc.downloadUrls(urls,
                         'supplementary files',
                         'supplementaryFiles.zip',
                         failed, done, eupmc, fourohfour)
    } else if (failed.length > 0) {
      log.warn(failed.length + ' downloads timed out on retry. Skipping.')
    } else if (missing > 0) {
      var succeeded = urls.length - missing
      var suffix = missing > 1 ? 's' : ''
      log.info(succeeded + ' downloads succeeded. ' + missing +
               ' paper' + suffix + ' had no supplementary files.')
    } else {
      log.info('All supplementary file downloads succeeded!')
    }
    eupmc.nextDlTask()
  })

  eupmc.downloadUrls(urls,
                     'supplementary files',
                     'supplementaryFiles.zip',
                     failed, done, eupmc, fourohfour)
}

EuPmc.prototype.downloadUrls = function (urls, type, rename, failed,
  cb, thisArg, fourohfour) {
  // setup progress bar
  var progmsg = 'Downloading files [:bar] :percent' +
                ' (:current/:total) [:elapseds elapsed, eta :eta]'
  var progopts = {
    total: urls.length,
    width: 30,
    complete: chalk.green('=')
  }
  var dlprogress = new ProgressBar(progmsg, progopts)

  urls.forEach(function (urlId) {
    var url = urlId[0]
    var id = urlId[1]
    var base = id + '/'
    log.debug('Creating directory: ' + base)
    mkdirp.sync(base)
    log.debug('Downloading ' + type + ': ' + url)
    var options = {
      timeout: 15000,
      encoding: null
    }
    got(url, options, function (err, data, res) {
      dlprogress.tick()
      if (err) {
        if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
          log.warn('Download timed out for URL ' + url)
        }
        if (!res) {
          failed.push(url)
        } else if ((res.statusCode === 404) && !(fourohfour === null)) {
          fourohfour()
        } else {
          failed.push(url)
        }
        cb()
      } else {
        fs.writeFile(base + rename, data, cb)
      }
    })
  })
}

EuPmc.prototype.getFulltextHTMLUrl = function (result, oa) {
  var eupmc = this
  var id = eupmc.getIdentifier(result)

  if (!result.fullTextUrlList) { return eupmc.noFulltextUrls(id) }

  var urls = result.fullTextUrlList[0].fullTextUrl
  var htmlUrls = urls.filter(function (u) {
    return (u.documentStyle[0] === 'html' || u.documentStyle[0] === 'doi')
  }).sort(function (a, b) {
    return (a.availabilityCode[0] === 'OA' || eupmc.opts.all) ? -1 : 1
  })
  if (htmlUrls.length === 0) {
    log.warn('Article with ' + id.type + ' "' +
             id.id + '" had no fulltext HTML url')
    return null
  } else {
    return htmlUrls[0].url[0]
  }
}

EuPmc.prototype.getIdentifier = function (result) {
  var types = ['pmcid', 'doi', 'pmid', 'title']
  for (var i = 0; i < types.length; i++) {
    var type = types[i]
    if (result.hasOwnProperty(type) && result[type].length > 0) {
      return {
        type: type,
        id: result[type][0]
      }
    }
  }

  return {
    type: 'error',
    id: 'unknown ID'
  }
}

EuPmc.prototype.getFulltextXMLUrl = function (result) {
  var eupmc = this

  var id = eupmc.getIdentifier(result)

  var xmlurl = null

  if (id.type === 'pmcid') {
    xmlurl = 'https://www.ebi.ac.uk/europepmc/webservices/rest/' +
    id.id + '/fullTextXML'
  } else {
    log.warn('Article with ' + id.type + ' "' +
             id.id + ' did not have a PMCID (therefore no XML)')
    return null
  }

  if (!result.fullTextUrlList) { return eupmc.noFulltextUrls(id) }

  var urls = result.fullTextUrlList[0].fullTextUrl
  var htmlUrls = urls.filter(function (u) {
    return (u.documentStyle[0] === 'html' || u.documentStyle[0] === 'doi')
  }).filter(function (a, b) {
    return (a.availabilityCode[0] === 'OA')
  })
  if (htmlUrls.length === 0) {
    log.warn('Article with ' + id.type + ' "' +
             id.id + '" was not Open Access (therefore no XML)')
    return null
  }

  return [xmlurl, id.id]
}

EuPmc.prototype.getFulltextPDFUrl = function (result) {
  var eupmc = this
  var id = eupmc.getIdentifier(result)

  var noPDF = function (id) {
    log.warn('Article with ' + id.type + ' "' +
                 id.id + '" had no fulltext PDF url')
    return null
  }

  if (!result.fullTextUrlList) { return eupmc.noFulltextUrls(id) }
  if (result.hasPDF === 'N') { return noPDF(id) }

  var urls = result.fullTextUrlList[0].fullTextUrl
  var pdfOAurls = urls.filter(function (u) {
    return u.documentStyle[0] === 'pdf' &&
    u.availabilityCode[0] === 'OA'
  })

  if (pdfOAurls.length === 0) {
    return noPDF(id)
  } else {
    return [pdfOAurls[0].url[0], id.id]
  }
}

EuPmc.prototype.urlQueueBuilder = function (urls, type, rename) {
  return urls.map(function (urlId) {
    return { url: urlId[0], id: urlId[1], type: type, rename: rename }
  })
}

EuPmc.prototype.getSuppFilesUrl = function (result) {
  var eupmc = this

  var id = eupmc.getIdentifier(result)

  if (id.type === 'pmcid') {
    return ['https://www.ebi.ac.uk/europepmc/webservices/rest/' +
    id.id + '/supplementaryFiles', id.id]
  } else {
    log.warn('Article with ' + id.type + ' "' +
             id.id + ' did not have a PMCID (therefore no supplementary files)')
    return null
  }
}

EuPmc.prototype.getMinedTermsURL = function (result) {
  var eupmc = this

  var id = eupmc.getIdentifier(result)

  if (id.type === 'pmcid') {
    return ['https://www.ebi.ac.uk/europepmc/webservices/rest/PMC/' +
    id.id + '/textMinedTerms//1/1000/json', id.id]
  } else {
    log.warn('Article with ' + id.type + ' "' +
             id.id + ' did not have a PMCID (therefore no mined terms)')
    return null
  }
}

EuPmc.prototype.summariseMinedTerms = function () {
  log.info('Writing mined term summary CSV files to minedterms_summary/')
  mkdirp.sync('minedterms_summary')
  var termstore = {}
  glob.sync(['*/textMinedTerms.json']).forEach(function (termsFile) {
    var json = fs.readFileSync(termsFile, 'utf8')
    var terms = JSON.parse(json)
    terms.semanticTypeList.semanticType.forEach(function (termset) {
      if (!termstore[termset.name]) {
        termstore[termset.name] = []
      }
      var rows = termset.tmSummary.map(function (term) {
        return [
          terms.request.id,
          '"' + term.term + '"',
          term.count,
          term.dbname,
          term.dbIdList.dbId.join(';')
        ]
      })
      termstore[termset.name] = termstore[termset.name].concat(rows)
    })
  })
  Object.keys(termstore).forEach(function (key) {
    var head = 'article,' + key + ',count,dbName,dbId\n'
    var csv = head + termstore[key].map(function (row) {
      return row.join(',')
    }).join('\n') + '\n'
    fs.writeFileSync('minedterms_summary/' + key + '.csv', csv, 'utf8')
  })
}

EuPmc.prototype.writeRecord = function (record, eupmc) {
  var json = JSON.stringify(record, null, 2)
  var id = eupmc.getIdentifier(record).id
  mkdirp.sync(id)
  fs.writeFileSync(id + '/eupmc_result.json', json)
}

EuPmc.prototype.noFulltextUrls = function (id) {
  log.debug('Article with ' + id.type + ' "' +
           id.id + '" had no fulltext Urls')
  return null
}

module.exports = EuPmc
