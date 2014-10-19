var nai = require('../lib/nai'),
  Promise = require('bluebird');


nai.renderFile(__dirname+'/simple.html', {
  locals: {
    getUsers: function() {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve("fraier 10!!!");
        }, 1);
      });
    }
  }
})
  .then(function(result) {
    console.log(result);
  });
