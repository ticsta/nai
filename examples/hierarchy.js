var nai = require('../lib/nai'),
  Promise = require('bluebird'),
  data = {
    first: {
      name: 'First'
    },
    second: {
      name: 'Second'
    },
    _3rd: {
      name: '3rd'
    }
  };

nai.renderFile(__dirname + '/hierarchy.html', {
    //debug: true,
    locals: {
      getKeys: function() {
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(Object.keys(data));
          }, Math.random() * 500);
        });
      },
      getValue: function(key) {
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(data[key]);
          }, Math.random() * 1200);
        });
      },
      getData: function(){
        return data;
      }
    }
  })
  .then(function(result) {
    console.log('=============== RESULT: ');
    console.log(result);
  });