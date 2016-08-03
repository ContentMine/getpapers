/* global log */

var fs = require('fs')
var chalk = require('chalk')
var mkdirp = require('mkdirp')
var _ = require('lodash')
var urlDl = require('./download.js')
var CrossRefAPI = require('crossref')
var sanitize = require("sanitize-filename")

var CrossRef = function (opts) {
  this.baseurl = 'http://api.crossref.org/works'

  this.opts = opts
}

CrossRef.prototype.search = function (query) {
  var crossref = this
  crossref.pagesize = 1000
  crossref.hitcount = 0
  crossref.first = true
  crossref.allresults = []

  function pageQuery (err, objects, nextOptions, isDone, message) {
    if (err) throw err

    if (crossref.first) {
      crossref.first = false
      crossref.hitcount = message['total-results']
      crossref.hitlimit = crossref.opts.hitlimit ? crossref.opts.hitlimit : crossref.hitcount
      log.info('Found', crossref.hitcount, 'results')
      if (crossref.opts.noexecute){ process.exit(0) }
    }

    crossref.allresults = crossref.allresults.concat(objects)

    var limitHit = crossref.hitlimit &&
      crossref.allresults.length >= crossref.hitlimit

    if (isDone || limitHit) {
      crossref.handleSearchResults(crossref)
    } else {
      CrossRefAPI.works(nextOptions, pageQuery)
    }
  }

  var message = {}
  if (query != null) { message.query = query}
  message.rows = crossref.pagesize

if (crossref.opts.filter) {
  var filters = crossref.opts.filter.split(',')
  message.filter = message.filter ? message.filter : {}
  for (var singleFilter of filters){
    if (!message.filter[singleFilter.split(':')[0]]) {
      message.filter[singleFilter.split(':')[0]] = []
    }
    message.filter[singleFilter.split(':')[0]].push(singleFilter.split(':')[1])
  }
}

  CrossRefAPI.works(message, pageQuery)
}

CrossRef.prototype.timeoutCallback = function (ms) {
  log.error('Did not get a response from CrossRef within ' + ms + 'ms')
}

CrossRef.prototype.formatResult = function (result) {
  var parts = {
    author: 'no authors',
    year: 'unknown year',
    title: 'no title'
  }

  if (result.author) {
    var authors = result.author.map(function (author) {
      return author.given + ' ' + author.family
    })
    if (authors.length > 3) {
      parts.author = authors[0] + ' et al.'
    } else if (authors.length === 2) {
      parts.author = authors.join(' & ')
    } else {
      parts.author = authors.join(', ')
    }
  }

  if (result['published-print']) {
    parts.year = result['published-print']['date-parts'][0][0]
  }

  if (result.title && result.title.length > 0) {
    parts.title = result.title[0]
  }

  return parts.author + ' (' + parts.year + '). ' +
  result.title + result.DOI ? ' http://dx.doi.org/' + result.DOI : ''
}

CrossRef.prototype.handleSearchResults = function (crossref) {
  // see how many results were unique
  var originalLength = crossref.allresults.length
  crossref.allresults = _.uniq(crossref.allresults, function (x) {
    return crossref.getIdentifier(x).id
  })
  if (crossref.allresults.length < originalLength) {
    log.info('Duplicate records found: ' +
      crossref.allresults.length +
      ' unique results identified')
  }
  if (crossref.allresults.length > crossref.hitlimit) {
    crossref.allresults = crossref.allresults.slice(0,crossref.hitlimit)
    log.info('limiting hits')
  }

  // write the full result set to a file
  log.info('Saving result metadata')
  var pretty = JSON.stringify(crossref.allresults, null, 2)
  fs.writeFileSync('crossref_results.json', pretty)
  var filename = chalk.blue('crossref_results.json')
  log.info('Full CrossRef result metadata written to ' + filename)

  // write individual results to their respective directories
  crossref.allresults.forEach(function (result) {
    crossref.writeRecord(result, crossref)
  })
  log.info('Individual CrossRef result metadata records written')

  var dlTasks = []

  // download the fullText XML
  if (crossref.opts.xml) {
    dlTasks.push(crossref.downloadFulltextXMLs)
  }

  // download the fullText PDF
  if (crossref.opts.pdf) {
    dlTasks.push(crossref.downloadFulltextPDFs)
  }

  crossref.runDlTasks(dlTasks)
}

CrossRef.prototype.runDlTasks = function (dlTasks) {
  var crossref = this

  crossref.dlTasks = dlTasks
  crossref.currDlTask = -1
  crossref.nextDlTask()
}

CrossRef.prototype.nextDlTask = function () {
  var crossref = this

  crossref.currDlTask++
  if (crossref.dlTasks.length > crossref.currDlTask) {
    var fun = crossref.dlTasks[crossref.currDlTask]
    fun(crossref)
  } else {
    process.exit(0)
  }
}

CrossRef.prototype.downloadFulltextXMLs = function (crossref) {
  var urls = crossref.allresults
    .map(crossref.getFulltextXMLUrl, crossref)
    .filter(function (x) { return !(x === null) })

  log.info('Got XML URLs for ' + urls.length + ' out of ' + crossref.allresults.length + ' results')

  log.info('Downloading fulltext XML files')

  var urlQueue = crossref.urlQueueBuilder(urls, 'XML', 'fulltext.xml')
  urlDl.downloadurlQueue(urlQueue, crossref.nextDlTask.bind(crossref))
}

CrossRef.prototype.downloadFulltextPDFs = function (crossref) {
  var urls = crossref.allresults
    .map(crossref.getFulltextPDFUrl, crossref)
    .filter(function (x) { return !(x === null) })

  log.info('Downloading fulltext PDF files')

  var urlQueue = crossref.urlQueueBuilder(urls, 'PDF', 'fulltext.pdf')
  urlDl.downloadurlQueue(urlQueue, crossref.nextDlTask.bind(crossref))
}

CrossRef.prototype.getIdentifier = function (result) {
  if (result.DOI) {
    return {
      type: 'doi',
      id: result.DOI
    }
  }

  return {
    type: 'error',
    id: 'unknown ID'
  }
}

CrossRef.prototype.getFulltextXMLUrl = function (result) {
  var crossref = this
  var id = crossref.getIdentifier(result)

  var noXML = function (id) {
    log.debug('Article with ' + id.type + ' "' +
      id.id + '" had no fulltext XML url')
    return null
  }

  if (!result.link) { return crossref.noFulltextUrls(id) }

  var urls = result.link
  var xmlurls = urls.filter(function (u) {
    return u['content-type'] === 'text/xml'
  })

  if (xmlurls.length === 0) {
    return noXML(id)
  } else {
    return [xmlurls[0].URL, id.id]
  }
}

CrossRef.prototype.getFulltextPDFUrl = function (result) {
  var crossref = this
  var id = crossref.getIdentifier(result)

  var noPDF = function (id) {
    log.debug('Article with ' + id.type + ' "' +
      id.id + '" had no fulltext PDF url')
    return null
  }

  if (!result.link) { return crossref.noFulltextUrls(id) }

  var urls = result.link
  var pdfurls = urls.filter(function (u) {
    return u['content-type'] === 'application/pdf'
  })

  if (pdfurls.length === 0) {
    return noPDF(id)
  } else {
    return [pdfurls[0].URL, id.id]
  }
}

CrossRef.prototype.urlQueueBuilder = function (urls, type, rename) {
  return urls.map(function (url_id) {
    return { url: url_id[0], id: url_id[1], type: type, rename: rename }
  })
}

CrossRef.prototype.writeRecord = function (record, crossref) {
  var json = JSON.stringify(record, null, 2)
  // First convert slashes to underscores to aid readability
  var id = crossref.getIdentifier(record).id.replace(/\//g,"_")
  var sanid = sanitize(id)
  mkdirp.sync(sanid)
  fs.writeFileSync(id + '/crossref_result.json', json)
}

CrossRef.prototype.noFulltextUrls = function (id) {
  log.debug('Article with ' + id.type + ' "' +
    id.id + '" had no fulltext Urls')
  return null
}

module.exports = CrossRef
