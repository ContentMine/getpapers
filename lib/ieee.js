var rest = require('restler')
, util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, got = require('got')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');

var IEEE = function(opts) {

  this.baseurl = 'http://ieeexplore.ieee.org/gateway/ipsSearch.jsp?'

  this.opts = opts;

}

IEEE.prototype.search = function(query) {

  var ieee = this;

  if (ieee.opts.xml) {
    log.warn("The IEEE API does not provide fulltext XML, so the --xml flag will be ignored");
  }
  if (ieee.opts.pdf) {
    log.warn("The IEEE API does not provide fulltext PDF links, do the --pdf glaf will be ignored");
  }

  options = {
    hc: 100
  };

  if (!ieee.opts.all) {
    options['oa'] = 1;
  }

  ieee.queryurl = ieee.buildQuery(query, options);
  ieee.first = true;
  ieee.hitcount = 0;
  ieee.allresults = [];
  ieee.iter = 0;

  ieee.pageQuery();

}

IEEE.prototype.pageQuery = function() {

  var ieee = this;

  var thisQueryUrl = ieee.queryurl;

  if (ieee.iter > 0) {
    var pageterm = '&rs=' + ieee.iter;
    thisQueryUrl += pageterm;
  }

  log.debug(thisQueryUrl);
  var rq = rest.get(thisQueryUrl, {timeout: 20000, parser: rest.parsers.xml});
  rq.on('complete', ieee.completeCallback.bind(ieee));
  rq.on('timeout', ieee.timeoutCallback);

}

IEEE.prototype.completeCallback = function(data) {

  var ieee = this;

  var totalfound = parseInt(data.root.totalfound[0]);
  var totalsearched = parseInt(data.root.totalsearched[0]);

  if (ieee.first) {

    ieee.first = false;
    ieee.hitcount = totalfound;
    var oaclause = ieee.opts.all ? '' : ' open access';
    log.info('Found ' + ieee.hitcount + oaclause + ' results');
    if (ieee.hitcount == 0) {
      process.exit(0);
    }

    // create progress bar
    var progmsg = 'Retrieving results [:bar] :percent' +
                  ' (eta :etas)';
    var progopts = {
      total: ieee.hitcount,
      width: 30,
      complete: chalk.green('=')
    };
    ieee.pageprogress = new ProgressBar(progmsg, progopts);

  }

  var result = data.root.document[0];
  ieee.allresults = ieee.allresults.concat(result);
  ieee.pageprogress.tick(result.length);

  if (ieee.allresults.length < ieee.hitcount) {
    ieee.iter += 1;
    ieee.pageQuery();
  } else {
    log.info('Done collecting results');
    ieee.handleSearchResults(ieee);
  }

}

IEEE.prototype.handleSearchResults = function(ieee) {

  // // see how many results were unique
  // var originalLength = eupmc.allresults.length;
  // ieee.allresults = _.uniq(eupmc.allresults, function(x) {
  //   return ieee.getIdentifier(x).id;
  // });
  // if (eupmc.allresults.length < originalLength) {
  //   log.info('Duplicate records found: ' +
  //            eupmc.allresults.length +
  //            ' unique results identified');
  // }

  // write the full result set to a file
  log.info('Saving result metdata');
  var pretty = JSON.stringify(ieee.allresults, null, 2);
  fs.writeFileSync('ieee_results.json', pretty)
  var filename = chalk.blue('ieee_results.json')
  log.info('Full IEEE result metadata written to ' + filename);

  // write only the url list to file
  log.info('The IEEE API does not provide fulltext HTML links, but we will try to guess them from other metadata');
  log.info('Extracting fulltext HTML URL list (may not be available for all articles)');
  var urls = ieee.allresults
    .map(ieee.getFulltextHTMLUrl, ieee)
    .filter(function(x) { return !(x === null) });
  log.info('Got fulltext HTML URLs for ' + urls.length + ' of ' + ieee.allresults.length + ' results')

  if (urls.length > 0) {
    fs.writeFileSync('fulltext_html_urls.txt', urls.join("\n"));
    var filename = chalk.blue('fulltext_html_urls.txt')
    log.info('Fulltext HTML URL list written to ' + filename);
  }
  //
  // var dlTasks = [];
  //
  // // download the fullText XML
  // if (ieee.opts.xml) {
  //   dlTasks.push(eupmc.downloadFulltextXMLs);
  // }
  //
  // // download the fullText PDF
  // if (eupmc.opts.pdf) {
  //   dlTasks.push(eupmc.downloadFulltextPDFs);
  // }
  //
  // // download the supplementary files
  // if (eupmc.opts.supp) {
  //   dlTasks.push(eupmc.downloadSuppFiles);
  // }
  //
  // eupmc.runDlTasks(dlTasks);

}

IEEE.prototype.timeoutCallback = function(ms) {

  log.error('Did not get a response from the IEEE API within ' + ms + 'ms');

};

IEEE.prototype.buildQuery = function(query, options) {

  var ieee = this;

  var queryurl = ieee.baseurl + 'querytext=' + encodeURIComponent(query);

  Object.keys(options).forEach(function(key) {
    var val = options[key];
    if (key.length > 0) {
      queryurl += '&' + key + '=' + val;
    }
  });

  return queryurl;

}


IEEE.prototype.getFulltextHTMLUrl = function(result, oa) {

  var ieee = this;

  if (result.htmlFlag && result.htmlFlag[0] === '1') {

    var arnumber = result.arnumber[0];

    return "http://ieeexplore.ieee.org/xpls/icp.jsp?arnumber=" + arnumber;

  } else {
    return null;
  }

}

module.exports = IEEE;
