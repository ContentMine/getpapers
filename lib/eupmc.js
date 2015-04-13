var rest = require('restler');

var eupmc = module.exports;

eupmc.baseurl = 'http://www.ebi.ac.uk/europepmc/webservices/rest/search/';

eupmc.search = function(query) {

  var queryurl = eupmc.baseurl + 'query=' + query;
  var rq = rest.get(queryurl, {timeout: 5000});

  rq.on('complete', function(data) {

    var resp = data.responseWrapper;
    console.log('Number of hits: ' + resp.hitCount[0]);

    var results = resp.resultList[0].result;
    console.log('First 25 hits:')
    results.forEach(function(result, i) {
      console.log(i + '. ' + eupmc.formatResult(result));
    });

  });

  rq.on('timeout', function(data) {

  })
}

eupmc.formatResult = function(result) {
  return result.authorString +
  ' (' + result.pubYear + '). ' +
  result.title + ' http://dx.doi.org/' + result.DOI;
}
