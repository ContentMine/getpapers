var rest = require('restler')
, util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, got = require('got')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');

var EuPmc = function() {

  this.baseurl = 'http://www.ebi.ac.uk/' +
                 'europepmc/webservices/rest/search/';

}

EuPmc.prototype.search = function(query) {

  var eupmc = this;

  query = query + " OPEN_ACCESS:y";
  var options = { resulttype: 'core' };
  eupmc.queryurl = eupmc.buildQuery(query, options);
  eupmc.first = true;
  eupmc.hitcount = 0;
  eupmc.allresults = [];
  eupmc.iter = 0;

  eupmc.pageQuery();

}

EuPmc.prototype.pageQuery = function() {

  var eupmc = this;

  var thisQueryurl = eupmc.queryurl + '';

  if (eupmc.iter > 0) {
    var pageterm = '&page=' + eupmc.iter;
    thisQueryurl += pageterm;
  }

  log.debug(thisQueryurl);
  var rq = rest.get(thisQueryurl, {timeout: 20000});
  rq.on('complete', eupmc.completeCallback.bind(eupmc));
  rq.on('timeout', eupmc.timeoutCallback);

}

EuPmc.prototype.completeCallback = function(data) {

  var eupmc = this;

  var resp = data.responseWrapper;

  if (eupmc.first){
    eupmc.first = false;
    eupmc.hitcount = parseInt(resp.hitCount[0]);
    log.info('Found ' + eupmc.hitcount + ' open access results;');

    // create progress bar
    var progmsg = 'Retrieving results [:bar] :percent' +
                  ' (eta :etas)';
    var progopts = {
      total: eupmc.hitcount,
      width: 30,
      complete: chalk.green('=')
    };
    eupmc.pageprogress = new ProgressBar(progmsg, progopts);
  }

  var result = resp.resultList[0].result;
  eupmc.allresults = eupmc.allresults.concat(result);
  eupmc.pageprogress.tick(result.length);

  if (eupmc.allresults.length < eupmc.hitcount) {
    eupmc.iter += 1;
    eupmc.pageQuery();
  } else {
    log.info('Done collecting results');
    eupmc.handleSearchResults(eupmc);
  }

}

EuPmc.prototype.timeoutCallback = function(ms) {

  log.error('Did not get a response within ' + ms + 'ms');

}

EuPmc.prototype.buildQuery = function(query, options) {

  var eupmc = this;

  var queryurl = eupmc.baseurl + 'query=' + query;
  Object.keys(options).forEach(function(key) {
    var val = options[key];
    if (key.length > 0) {
      queryurl += '&' + key + '=' + val;
    }
  });
  return queryurl;

}

EuPmc.prototype.formatResult = function(result) {

  return result.authorString +
  ' (' + result.pubYear + '). ' +
  result.title + ' http://dx.doi.org/' + result.DOI;

}

EuPmc.prototype.handleSearchResults = function(eupmc) {

  // see how many results were unique
  var originalLength = eupmc.allresults.length;
  eupmc.allresults = _.uniq(eupmc.allresults, function(x) {
    return eupmc.getIdentifier(x).id;
  });
  if (eupmc.allresults.length < originalLength) {
    log.info('Duplicate records found: ' +
             eupmc.allresults.length +
             ' unique results identified');
  }

  // write the full result set to a file
  log.info('Saving result metdata');
  var pretty = JSON.stringify(eupmc.allresults, null, 2);
  fs.writeFileSync('all_results.json', pretty)
  var filename = chalk.blue('all_results.json')
  log.info('Full result metadata written to ' + filename);

  // write only the url list to file
  log.info('Extracting Open Access fulltext URLlist');
  var urls = eupmc.allresults
    .map(eupmc.getOAFulltextHTMLUrl, eupmc)
    .filter(function(x) { return !(x === null) });
  fs.writeFileSync('fulltext_OA_html_urls.txt', urls.join("\n"));
  var filename = chalk.blue('fulltext_OA_html_urls.txt')
  log.info('Full Open Access URL list written to ' + filename);

  // download the fullText XML
  eupmc.downloadFulltextXMLs();

}

EuPmc.prototype.downloadFulltextXMLs = function() {

  var eupmc = this;

  log.info('Extracting fulltext XML URLlist');
  urls = eupmc.allresults
    .map(eupmc.getFulltextXMLUrl, eupmc)
    .filter(function(x) { return !(x === null) });

  log.info('Downloading fulltext XML files');

  var failed = [];
  var retries = 0;

  var done = _.after(urls.length, function() {
    if (failed.length > 0 && retries == 0) {
      log.info(failed.length + ' downloads timed out. Retrying.');
      failed = [];
      eupmc.downloadUrls(urls, 'XML', 'fulltext.html',
                         failed, done, eupmc);
    } else if (failed.length > 0) {
      log.info(failed.length + ' downloads timed on retry. Skipping.');
    } else {
      log.info('All downloads succeeded!');
      process.exit(0);
    }
  });

  eupmc.downloadUrls(urls, 'XML', 'fulltext.html',
                     failed, done, eupmc);
}

EuPmc.prototype.downloadUrls = function(urls, type, rename, failed, cb, thisArg) {

  var eupmc = thisArg;

  // setup progress bar
  var progmsg = 'Downloading files [:bar] :percent' +
                ' (eta :etas)';
  var progopts = {
    total: urls.length,
    width: 30,
    complete: chalk.green('=')
  };
  var dlprogress = new ProgressBar(progmsg, progopts);

  urls.forEach(function(url, i) {
    var base = eupmc.getIdentifier(eupmc.allresults[i]).id + '/';
    log.debug('Creating directory: ' + base);
    mkdirp.sync(base);
    log.debug('Downloading ' + type + ': ' + url);
    var get = got(url, {timeout: 15000}, function(err, data, resp) {
      dlprogress.tick();
      if (err) {
        failed.push(url);
        cb();
      } else {
        fs.writeFile(base + rename, data, cb);
      }
    });
  });
}


EuPmc.prototype.getOAFulltextHTMLUrl = function(result) {

  var eupmc = this;

  var urls = result.fullTextUrlList[0].fullTextUrl;
  var htmlOAurls = urls.filter(function(u) {
    return u.documentStyle[0] == 'html' &&
    u.availabilityCode[0] == 'OA'
  });

  if (htmlOAurls.length == 0) {
    var id = eupmc.getIdentifier(result);
    log.warn('Article with ' + id.type + ' "' +
             id.id + '" had no fulltext HTML url');
    return null;
  } else {
    return htmlOAurls[0].url[0];
  }

}

EuPmc.prototype.getIdentifier = function(result) {

  var types = ['pmcid', 'doi', 'pmid', 'title'];
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
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


EuPmc.prototype.getFulltextXMLUrl = function(result) {

  var eupmc = this;

  var id = eupmc.getIdentifier(result);

  if (id.type == 'pmcid') {
    return 'http://www.ebi.ac.uk/europepmc/webservices/rest/' +
    id.id + '/fullTextXML';
  } else {
    log.warn('Article with ' + id.type + ' "' +
             id.id + ' did not have a PMCID (therefore no XML)');
    return null;
  }

}

module.exports = EuPmc;
