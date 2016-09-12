var util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, got = require('got')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');
var sanitize = require("sanitize-filename")

exports.downloadurlQueue = function(fullurlQueue, nextDlTaskcb) {
  var failed = [];
  var retries = 0;
  var missing = 0;

  urlQueue = fullurlQueue; //urlQueue needs to be global unless
                          //we put these other functions inside
                          //this one.

  //Setup ProgressBar
  var progmsg = 'Downloading files [:bar] :percent' +
              ' (:current/:total) [:elapseds elapsed, eta :eta]';
  var progopts = {
    total: fullurlQueue.length,
    width: 30,
    complete: chalk.green('=')
  };
  var dlprogress = new ProgressBar(progmsg, progopts);

  for(i=0; i<10; i++) {
  nextUrlTask(urlQueue); //spawn 10 workers
  }

function nextUrlTask() {
  if (urlQueue instanceof Array && urlQueue.length > 0) {
    var urlObj = urlQueue.splice(0,1)[0];
    downloadURL(urlObj);
  }
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

  var get = got(url, options, function(err, data, res) {
    dlprogress.tick();
    if (err) {
      if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
        log.warn('Download timed out for URL ' + url);
      }
      if (!res) {
        failed.push(url);
      } else if ((res.statusCode == 404) && !(fourohfour === null)) {
        fourohfour();
      } else {
        failed.push(url);
      }
      done();
    } else {
      fs.writeFile(base + rename, data, done);
    }
      nextUrlTask(urlQueue);
    });
  }

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

  var fourohfour = function() {
    missing ++;
  }
}
