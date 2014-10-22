var nai = require('../lib/nai'),
  Promise = require('bluebird');


nai.renderFile(__dirname + '/js.html', {
  locals: {
    document: {
      id: 12
    }
  }
})
  .then(function(result) {
    console.log('==================');
    console.log(result);
  });
