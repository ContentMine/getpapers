var rest = require('restler')
, util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, got = require('got')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');

var ArXiv = function(opts) {

  this.baseurl = 'http://export.arxiv.org/api/query?search_query='

  this.opts = opts;

}

ArXiv.prototype.search = function(query) {

  var arxiv = this;

  if (arxiv.opts.xml) {
    log.warn("The ArXiv API does not provide fulltext XML, so the --xml flag will be ignored");
  }

  options = {
    max_results: 10
  };

  arxiv.queryurl = arxiv.buildQuery(query, options);
  arxiv.first = true;
  arxiv.hitcount = 0;
  arxiv.allresults = [];
  arxiv.iter = 0;

  arxiv.pageQuery();

}

ArXiv.prototype.pageQuery = function() {

  var arxiv = this;

  var thisQueryUrl = arxiv.queryurl;

  if (arxiv.iter > 0) {
    var pageterm = '&start=' + arxiv.iter;
    thisQueryUrl += pageterm;
  }

  log.debug(thisQueryUrl);
  var rq = rest.get(thisQueryUrl, {timeout: 20000, parser: rest.parsers.xml});
  rq.on('complete', arxiv.completeCallback.bind(arxiv));
  rq.on('timeout', arxiv.timeoutCallback);

}

ArXiv.prototype.completeCallback = function(data) {

  var arxiv = this;

  var totalfound = parseInt(data.feed['opensearch:totalResults'][0]._);

  if (arxiv.first) {

    arxiv.first = false;
    arxiv.hitcount = totalfound;
    log.info('Found ' + arxiv.hitcount + ' results');
    if (arxiv.hitcount == 0) {
      process.exit(0);
    }

    // create progress bar
    var progmsg = 'Retrieving results [:bar] :percent' +
                  ' (eta :etas)';
    var progopts = {
      total: arxiv.hitcount,
      width: 30,
      complete: chalk.green('=')
    };
    arxiv.pageprogress = new ProgressBar(progmsg, progopts);

  }

  var result = data.feed.entry;
  arxiv.allresults = arxiv.allresults.concat(result);
  arxiv.pageprogress.tick(result.length);

  if (arxiv.allresults.length < arxiv.hitcount) {
    arxiv.iter += 1;
    arxiv.pageQuery();
  } else {
    log.info('Done collecting results');
    arxiv.handleSearchResults(arxiv);
  }

}

ArXiv.prototype.handleSearchResults = function(arxiv) {

  // write the full result set to a file
  log.info('Saving result metdata');
  var pretty = JSON.stringify(arxiv.allresults, null, 2);
  fs.writeFileSync('arxiv_results.json', pretty)
  var filename = chalk.blue('arxiv_results.json')
  log.info('Full ArXiv result metadata written to ' + filename);


  var dlTasks = [];

  // download the fullText PDF
  if (arxiv.opts.pdf) {
    dlTasks.push(arxiv.downloadFulltextPDFs);
  }

  // download the supplementary files
  if (arxiv.opts.supp) {
    dlTasks.push(arxiv.downloadSuppFiles);
  }

  arxiv.runDlTasks(dlTasks);

}

ArXiv.prototype.runDlTasks = function(dlTasks) {

  var arxiv = this;

  arxiv.dlTasks = dlTasks;
  arxiv.currDlTask = -1;
  arxiv.nextDlTask();

}

ArXiv.prototype.nextDlTask = function() {

  var arxiv = this;

  arxiv.currDlTask ++;
  if (arxiv.dlTasks.length > arxiv.currDlTask) {
    var fun = arxiv.dlTasks[arxiv.currDlTask];
    fun(arxiv);
  } else {
    process.exit(0);
  }

}

ArXiv.prototype.timeoutCallback = function(ms) {

  log.error('Did not get a response from the ArXiv API within ' + ms + 'ms');

};

ArXiv.prototype.buildQuery = function(query, options) {

  var arxiv = this;

  var queryurl = arxiv.baseurl + encodeURIComponent(query);

  Object.keys(options).forEach(function(key) {
    var val = options[key];
    if (key.length > 0) {
      queryurl += '&' + key + '=' + val;
    }
  });

  return queryurl;

}

ArXiv.prototype.getFulltextPDFUrl = function(result) {

  var arxiv = this;

  var urls = result.link;
  var pdfurls = urls.filter(function(u) {
    return u['$'].type === "application/pdf";
  });

  if (pdfurls.length == 0) {
    return null;
  } else {
    return pdfurls[0]['$'].href;
  }

}

ArXiv.prototype.getIdentifier = function(result) {
  return result.id[0];
}

ArXiv.prototype.getSuppFilesUrl = function(result) {

  var arxiv = this;

  var id = arxiv.getIdentifier(result);


  return id.split('abs').join('e-print');

}

ArXiv.prototype.downloadFulltextPDFs = function(arxiv) {

  urls = arxiv.allresults
    .map(arxiv.getFulltextPDFUrl, arxiv)
    .filter(function(x) { return !(x === null) });

  log.info('Downloading fulltext PDF files');

  var failed = [];
  var retries = 0;

  var done = _.after(urls.length, function() {
    if (failed.length > 0 && retries == 0) {
      log.warn(failed.length + ' downloads timed out. Retrying.');
      failed = [];
      arxiv.downloadUrls(urls, 'PDF', 'fulltext.pdf',
                         failed, done, arxiv);
    } else if (failed.length > 0) {
      log.warn(failed.length + ' downloads timed on retry. Skipping.');
    } else {
      log.info('All PDF downloads succeeded!');
    }
    arxiv.nextDlTask();
  });

  arxiv.downloadUrls(urls, 'PDF', 'fulltext.pdf',
                     failed, done, arxiv);
}

ArXiv.prototype.downloadSuppFiles = function(arxiv) {

  urls = arxiv.allresults
    .map(arxiv.getSuppFilesUrl, arxiv)
    .filter(function(x) { return !(x === null) });

  log.info('Downloading supplementary files');

  var failed = [];
  var retries = 0;
  var missing = 0;

  var fourohfour = function() {
    missing ++;
  }

  var done = _.after(urls.length, function() {
    if (failed.length > 0 && retries == 0) {
      log.warn(failed.length + ' downloads timed out. Retrying.');
      failed = [];
      arxiv.downloadUrls(urls,
                         'supplementary files',
                         'supplementaryFiles.tar.gz',
                         failed, done, arxiv, fourohfour);
    } else if (failed.length > 0) {
      log.warn(failed.length + ' downloads timed on retry. Skipping.');
    } else if (missing > 0) {
      var succeeded = urls.length - missing;
      var suffix = missing > 1 ? 's' : ''
      log.info(succeeded + ' downloads succeeded. ' + missing +
               ' paper' + suffix + ' had no supplementary files.');
    } else {
      log.info('All supplementary file downloads succeeded!');
    }
    arxiv.nextDlTask();
  });

  arxiv.downloadUrls(urls,
                     'supplementary files',
                     'supplementaryFiles.tar.gz',
                     failed, done, arxiv, fourohfour);
}

ArXiv.prototype.downloadUrls = function(urls, type, rename, failed,
  cb, thisArg, fourohfour) {

  var arxiv = thisArg;

  // setup progress bar
  var progmsg = 'Downloading files [:bar] :percent' +
                ' (:current/:total) [:elapseds elapsed, eta :eta]';
  var progopts = {
    total: urls.length,
    width: 30,
    complete: chalk.green('=')
  };
  var dlprogress = new ProgressBar(progmsg, progopts);

  urls.forEach(function(url, i) {
    var base = arxiv.getIdentifier(arxiv.allresults[i]).split('abs/')[1] + '/';
    log.debug('Creating directory: ' + base);
    mkdirp.sync(base);
    log.debug('Downloading ' + type + ': ' + url);
    var options = {
      timeout: 15000,
      encoding: null
    }
    var get = got(url, options, function(err, data, res) {
      dlprogress.tick();
      if (err) {
        if (!res) {
          failed.push(url);
        } else if ((res.statusCode == 404) && !(fourohfour === null)) {
          fourohfour();
        } else {
          failed.push(url);
        }
        cb();
      } else {
        fs.writeFile(base + rename, data, cb);
      }
    });
  });
}

module.exports = ArXiv;
