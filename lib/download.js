var util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, requestretry = require('requestretry')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');
var sanitize = require("sanitize-filename")

exports.downloadurlQueue = function(urlQueue, nextDlTaskcb) {
  var failed = [];
  var retries = 0;
  var missing = 0;

  //Setup ProgressBar
  var progmsg = 'Downloading files [:bar] :percent' +
              ' (:current/:total) [:elapseds elapsed, eta :eta]';
  var progopts = {
    total: urlQueue.length,
    width: 30,
    complete: chalk.green('=')
  };
  var dlprogress = new ProgressBar(progmsg, progopts);

  var donefunc = function() {
    if (failed.length > 0) {
      log.warn(failed.length + ' downloads timed out on retry.');
    } else if (missing > 0) {
      var succeeded = urlQueue.length - missing;
      var suffix = missing > 1 ? 's' : ''
      log.info(succeeded + ' downloads succeeded. ' + missing +
               ' paper' + suffix + ' had urlQueue that could not be reached (404 error).');
    } else {
      log.info('All downloads succeeded!');
    }
    nextDlTaskcb();
  }

  var done = _.after(urlQueue.length, donefunc);

  for(var i=0; i<10; i++) {
  nextUrlTask(urlQueue); //spawn 10 workers
  }

function nextUrlTask() {
  if (urlQueue instanceof Array && urlQueue.length > 0) {
    var urlObj = urlQueue.splice(0,1)[0];
    testIfFileExists(urlObj, downloadURL);
  }
  else {
    log.debug('ending thread because urlQueue is now empty' )
  }
}

// Run callback if file doesn't exist
function testIfFileExists(urlObj, cb) {
  dlprogress.tick();
  var url = urlObj.url;
  var id = urlObj.id;
  var type = urlObj.type;
  var rename = urlObj.rename;
  var base = id + '/';
  fs.readFile(base + rename, (err, data) => {
    if ((err)&&(err.code=='ENOENT')) {
      cb(urlObj)
      return
      //File doesn't exist so start download procedure
    }
    else if (err) {
      throw err
    }
    else {
      log.info('File of type: '+type+' and id: '+id+' already exists. Skipping.')
      nextUrlTask(urlQueue)
      return
    }
  })
}

function downloadURL(urlObj) {
  var url = urlObj.url;
  var id = urlObj.id;
  var type = urlObj.type;
  var rename = sanitize(urlObj.rename);
  var base = sanitize(id) + '/';
  log.debug('Creating directory: ' + base);
  mkdirp.sync(base);

  log.debug('Downloading ' + type + ': ' + url);
  var options = {
    timeout: 15000,
    encoding: null,
    retries: 3
  }

  function fileWriteCB(err) {
    if (err) throw error
    done()
  }

  function handleDownload(data) {
      fs.writeFile(base + rename, data, fileWriteCB);
      nextUrlTask(urlQueue);
    }

  function throwErr(err){
    if (err) throw err
  }

  rq = requestretry.get({url: url, fullResponse: false} );
  rq.then(handleDownload)
  rq.catch(throwErr)
}

  var fourohfour = function() {
    missing ++;
  }
}
