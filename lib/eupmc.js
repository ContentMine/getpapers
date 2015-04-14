var rest = require('restler')
, util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, Download = require('download');

var EuPmc = function() {
  this.baseurl = 'http://www.ebi.ac.uk/europepmc/webservices/rest/search/';
}

EuPmc.prototype.search = function(query) {

  var eupmc = this;

  // set up the file to capture results
  var tmp = fs.createWriteStream('getpapers_results.json');

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
    eupmc.hitcount = resp.hitCount[0];
    log.info('Found ' + eupmc.hitcount + ' open access results;');
    log.info('Downloading metadata in batches of 25');
  }

  var result = resp.resultList[0].result;
  eupmc.allresults = eupmc.allresults.concat(result);
  log.info('.. ' + eupmc.allresults.length + ' ..');

  if (eupmc.allresults.length < eupmc.hitcount) {
    eupmc.iter += 1;
    eupmc.pageQuery();
  } else {
    log.info('Done collecting results');
    eupmc.handleSearchResults();
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

EuPmc.prototype.handleSearchResults = function() {

  var eupmc = this;

  // write the full result set to a file
  log.info('Saving result metdata');
  var pretty = JSON.stringify(eupmc.allresults, null, 2);
  fs.writeFileSync('all_results.json', pretty)
  var filename = chalk.blue('all_results.json')
  log.info('Full result metadata written to ' + filename);

  // write only the url list to file
  log.info('Extracting Open Access fulltext URLlist');
  var urls = eupmc.allresults.map(eupmc.getOAFulltextHTMLUrl);
  fs.writeFileSync('fulltext_OA_html_urls.txt', urls.join("\n"));
  var filename = chalk.blue('fulltext_OA_html_urls.txt')
  log.info('Full Open Access URL list written to ' + filename);

  // download the fullText XML
  log.info('Extractng fulltext XML URLlist');
  urls = eupmc.allresults.map(eupmc.getFulltextXMLUrl);
  fs.writeFileSync('fulltext_OA_xml_urls.txt', urls.join("\n"));
  var filename = chalk.blue('fulltext_OA_xml_urls.txt')
  log.info('Full XML URL list written to ' + filename);

  // help the user download
  log.info('All done!');
  log.info('To download the fulltext XML files, use `wget -i fulltext_OA_xml_urls.txt`');
}

EuPmc.prototype.getOAFulltextHTMLUrl = function(result) {
  var urls = result.fullTextUrlList[0].fullTextUrl;
  return urls.filter(function(u) {
    return u.documentStyle[0] == 'html' &&
           u.availabilityCode[0] == 'OA'
  })[0].url[0];
}


EuPmc.prototype.getFulltextXMLUrl = function(result) {
  return 'http://www.ebi.ac.uk/europepmc/webservices/rest/' +
  result.pmcid[0] + '/fullTextXML';
}

module.exports = EuPmc;
