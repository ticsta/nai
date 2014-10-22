var nai = require('../lib/nai'),
  Promise = require('bluebird');


nai.renderFile(__dirname+'/simple.html', {
  debug: true,
  locals: {
    getUsers: function() {
      return new Promise(function(resolve) {
        var time = getRandomInt(10, 2000);
        setTimeout(function() {
          resolve("waiting for "+time+" ms");
        }, time);
      });
    }
  }
})
  .then(function(result) {
    console.log('==================');
    console.log(result);
  });

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}