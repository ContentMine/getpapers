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
    log.warn("The IEEE API does not provide fulltext PDF links, so the --pdf  will be ignored");
  }
  if (ieee.opts.supp) {
    log.warn("The IEEE API does not provide supplementary materials, so the --supp will be ignored");
  }

  ieee.pagesize = 200;
  
  options = {
    hc: ieee.pagesize
  };

  if (!ieee.opts.all) {
    options['oa'] = 1;
  }

  ieee.queryurl = ieee.buildQuery(query, options);
  ieee.first = true;
  ieee.residualhits = 0;
  ieee.hitlimit = ieee.opts.hitlimit ? ieee.opts.hitlimit : 0;
  ieee.hitcount = 0;
  ieee.allresults = [];
  ieee.iter = 1;

  ieee.timeouts = 0;

  ieee.resultstream = fs.createWriteStream('ieee_results.json');
  ieee.fulltextURLstream = fs.createWriteStream('ieee_fulltext_html_urls.txt');

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
  rq.on('timeout', ieee.timeoutCallback.bind(ieee));

}

IEEE.prototype.completeCallback = function(data) {

  var ieee = this;

  var totalfound = 0;

  if (data.hasOwnProperty('root')) {
    var totalfound = parseInt(data.root.totalfound[0]);
  }

  if (ieee.first) {

    ieee.first = false;
    ieee.hitcount = totalfound;
    var oaclause = ieee.opts.all ? '' : ' open access';
    log.info('Found ' + ieee.hitcount + oaclause + ' results');
    if (ieee.hitcount == 0 || ieee.opts.noexecute) {
      process.exit(0);
    }

    log.info('The IEEE API does not provide fulltext HTML links, but we will try to guess them from other metadata');

	// set hitlimit
    if (ieee.hitlimit && ieee.hitlimit < ieee.hitcount) {
      log.info('Limiting to ' + ieee.hitlimit + ' hits');
    }
    else { ieee.hitlimit = ieee.hitcount; }
	
    // create progress bar
    var progmsg = 'Fetching result metadata [:bar] :percent' +
                  ' (:current/:total) [:elapseds elapsed, eta :etas]';
    var progopts = {
      total: ieee.hitlimit,
      width: 30,
      complete: chalk.green('=')
    };
    ieee.pageprogress = new ProgressBar(progmsg, progopts);

  }

  if(!ieee.residualhits) { var result = data.root.document; }
  else { var result = data.root.document.slice(0,ieee.residualhits); }
  var pretty = JSON.stringify(result, null, 2);
  ieee.resultstream.write(pretty);

  var urls = ieee.getFulltextHTMLUrls(result);
  urls.forEach(function(url) { ieee.fulltextURLstream.write(url + '\n') });

  ieee.allresults = ieee.allresults.concat(result);
  ieee.pageprogress.tick(result.length);

  if (ieee.allresults.length < ieee.hitcount) {
    ieee.iter += 1;
	remaininghits = ieee.hitcount - ieee.allresults.length;
	if(remaininghits<ieee.pagesize) { ieee.residualhits = remaininghits; }
	log.debug(ieee.allresults.length);
    ieee.pageQuery();
  } else {
    log.info('Done collecting results. Got ' + ieee.allresults.length);
    ieee.handleSearchResults(ieee);
  }

}

IEEE.prototype.handleSearchResults = function(ieee) {

  // write the full result set to a file
  log.info('Saving result metadata');
  var pretty = JSON.stringify(ieee.allresults, null, 2);
  fs.writeFileSync('ieee_results.json', pretty)

  var filename = chalk.blue('ieee_results.json')
  log.info('Full IEEE result metadata written to ' + filename);

  ieee.fulltextURLstream.end();
  filename = chalk.blue('ieee_fulltext_html_urls.txt')
  log.info('Fulltext HTML URL list written to ' + filename);

}

IEEE.prototype.timeoutCallback = function(ms) {

  var ieee = this;

  log.error('Did not get a response from the IEEE API within ' + ms + 'ms');
  log.error('There have been ' + ieee.timeouts + ' total timeouts');
  ieee.timeouts += 1;

  if (ieee.timeouts > 99) {

    log.info('Timed out 100 times - the connection is probably broken');
    log.info('You have either been disconnected from the internet, or ' +
             'the API provider has blocked your IP');
    process.exit(1);

  } else {

    log.info('Retrying timed-out query');
    ieee.pageQuery();

  }

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


IEEE.prototype.getFulltextHTMLUrl = function(result) {

  var ieee = this;

  if (result.htmlFlag && result.htmlFlag[0] === '1') {

    var arnumber = result.arnumber[0];

    var url = "http://ieeexplore.ieee.org/xpls/icp.jsp?arnumber=" + arnumber;
    result.html = url;
    return url;

  } else {
    return null;
  }

}

IEEE.prototype.getFulltextHTMLUrls = function(results) {

  var ieee = this;

  return results
    .map(ieee.getFulltextHTMLUrl, ieee)
    .filter(function(x) { return !(x === null) });

}

module.exports = IEEE;
