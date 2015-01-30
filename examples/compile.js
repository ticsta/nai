var nai = require('../lib/nai'),
  Promise = require('bluebird'),
  fs = require('fs'),
  time = Date.now();

var fn = nai.compile(fs.readFileSync(__dirname + '/complex.html', 'utf8'), {
  //debug: true,
  vm: true
});
console.log('compile time: ', Date.now() - time);
time = Date.now();

var locals = {
  document: {

  },
  site: {
    title: 'site title'
  },
  asset_src: function(name) {
    return '//' + name;
  },
  doc_url: function(doc) {
    return '//' + doc.title;
  },
  da: {
    news: {
      latestNews: function() {
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve([{
              title: "title1",
              id: 1
            }, {
              title: "title2"
            }, {
              title: "title3"
            }]);
          }, 100);
        });
      }
    }
  }
};


fn(locals).then(function(result) {
  console.log('1. 1st render time: ', Date.now() - time);
  time = Date.now();
  locals.site.title = '2nd title';
  fn(locals).then(function(result) {
    console.log('1. 2st render time: ', Date.now() - time);
    time = Date.now();
  });
});
var time2 = Date.now();
fn(locals).then(function(result) {
  console.log('2. 1st render time: ', Date.now() - time2);
  time2 = Date.now();
  locals.site.title = '2. 2nd title';
  fn(locals).then(function(result) {
    console.log('2. 2st render time: ', Date.now() - time2);
    time2 = Date.now();
  });
});
