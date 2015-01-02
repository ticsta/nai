var nai = require('../lib/nai'),
  Promise = require('bluebird');


nai.renderFile(__dirname + '/notext.html', {
    debug: true,
    locals: {
      data: [{
        info: 'haha'
      }, {
        id: 1,
        list: [1, 2, 34]
      }]
    }
  })
  .then(function(result) {
    console.log('==================');
    console.log(result);
  }).catch(function(error){
    console.trace(error);
  });