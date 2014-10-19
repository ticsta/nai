var Promise = require('bluebird'),
  JsNode = require('./node').JsNode,
  TextNode = require('./node').TextNode,
  read = require('fs').readFileSync;

function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};

function initOptions(options) {
  options = options || {};
  options.open = options.open || '<%';
  options.close = options.close || '%>';
  options.resultFnName = '__NAI__result';
  options.stackName = 'naiSTCK__';
  options.locals = options.locals || {};

  return options;
}

/**
 * Intermediate js cache.
 *
 * @type Object
 */

var cache = {};

/**
 * Clear intermediate js cache.
 *
 * @api public
 */

exports.clearCache = function() {
  cache = {};
};

exports.render = module.exports.render = function(str, options) {
  options = initOptions(options);
  var fn = exports.compile(str, options);
  return fn(options.locals).then(function(result) {
    return buildHtml(result);
  });
}

exports.compile = function(str, options) {
  //var date = Date.now();
  options = initOptions(options);
  //str = JSON.stringify(str);
  //str = str.substr(1, str.length - 2);
  str = str.replace(/\n/g, '\\n');

  var root = new JsNode('', '', '', 0, 0);
  var finder = {
    open: options.open,
    close: options.close,
    reg: new RegExp(options.open + '([-=+]?)((?!' + options.close + ').)*' + options.close, 'i')
  };

  buildNode(root, str, finder, 0, 0);
  //console.log('build nodes in: ', Date.now() - date);
  //console.log('nodes: ', root.children);
  // root.children.forEach(function(item) {
  //   if (item.type == '+')
  //     console.log(item);
  // });

  var code = ['var ' + options.resultFnName + ';'];
  code.push('\nwith (locals || {}) {');
  code.push('\n' + options.resultFnName + '=(function(){');
  code.push('\nvar ' + options.stackName + '={};');
  code.push('\n' + options.stackName + '.' + root.id + '=[];');
  buildCode(root, options, 0, 0, code, '');
  code.push('\n})();');
  code.push('\n}');
  code.push('\nreturn ' + options.resultFnName + ';');
  code = code.join('');
  console.log('code: ', code);
  //console.log('build code in: ', Date.now() - date);

  var fn = new Function('locals, escape, Promise', code);

  //var fnResult = fn.call(options.scope || {}, options.locals, escape, Promise);

  //console.log(fnResult);
  return function(locals) {
    return fn.call(this, locals, escape, Promise);
  };
}

function buildHtml(list, html) {
  html = html || '';
  list.forEach(function(item) {
    if (item.length) {
      html += buildHtml(item, html);
    } else {
      html += item.result;
    }
  });
  return html;
}

function buildCode(node, options, depth, index, code, parent, temp) {
  var resultFnName = options.resultFnName;
  var stack = parent && options.stackName + '.' + parent.id;
  temp = temp || [];

  function _push(result) {
    _code(stack + '.push({result:' + result + ',depth: ' + depth + ',index: ' + index + '});');
  }

  function _code(line) {
    //line = JSON.stringify(line);
    //code.push('\n'+line.substr(1, line.length - 2));
    code.push('\n' + line);
  }

  if (node._type == 'text') {
    _push("'" + node.inner + "'");
    return code;
  }

  if (node.code && node.code.trim().length > 0) {
    var js = node.code.trim();
    js = js[js.length - 1] == ';' ? js.substr(0, js.length - 1) : js;

    if (node.type == '-') {
      _push(js);
    } else if (node.type == '=') {
      _push('escape(' + js + ')');
    } else if (node.type == '+') {
      _code(stack + '.push(' + node.code);
      temp.push(node.depth);
      //console.log('in async: ', node.depth);
    } else if (node.isClosing && temp.length > 0 && temp[temp.length - 1] == node.depth) {
      _code(node.code + ');');
      temp.pop();
      //console.log('OUT async');
    } else {
      //if (temp.length > 0 && node.isClosing)
      //  console.log('as TEMP: ', temp, node.depth);
      _code(node.code.replace(/\\n/g, '\n'));
    }
  }



  if (node.children && node.children.length > 0) {
    //stack && _code(stack + '=' + stack + '||[];');
    //temp=[];
    stack = options.stackName + '.' + node.id;
    _code(stack + ' = ' + stack + ' || [];');
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      buildCode(child, options, depth + 1, i, code, node, temp);
    }
    _code('return Promise.all(' + stack + ');');
  }

  return code;
}

function buildNode(root, input, finder, lineno, index, parent) {

  var result = finder.reg.exec(input);

  if (!result) {
    (parent || root).addChild(new TextNode(input, lineno, index));
    return;
  }

  var inner = result[0];
  var type = result[1];
  var code = inner.substr(finder.open.length + type.length);
  code = code.substr(0, code.length - finder.close.length);

  index += result.index;

  if (result.index > 0) {
    var s = input.substr(0, result.index);
    lineno += (s.match(/\n/g) || []).length;
    root.addChild(new TextNode(s, lineno, index));
  }

  lineno += (result[0].match(/\n/g) || []).length;

  var node = new JsNode(inner, type, code, lineno, index);

  input = input.substr(result.index + result[0].length);

  if (node.isClosing) {
    parent.addChild(node);
    return buildNode(parent, input, finder, lineno, index, parent.parent);
  }

  root.addChild(node);

  if (node.isOpening) {
    return buildNode(node, input, finder, lineno, index, root);
  }

  if (input.length > 0) {
    return buildNode(root, input, finder, lineno, index, parent);
  }
}

/**
 * Render a nai file at the given `path` and callback `fn(err, str)`.
 *
 * @param {String} path
 * @param {Object|Function} options or callback
 * @param {Function} fn
 * @api public
 */
exports.renderFile = function(path, options) {
  var key = path + ':string';

  options = options || {};
  options.filename = path;

  var str = options.cache ? cache[key] || (cache[key] = read(path, 'utf8')) : read(path, 'utf8');
  return exports.render(str, options);
};


exports.__express = function __express(path, options, fn) {
  try {
    exports.renderFile(path, options)
      .then(function(result) {
        fn(null, result);
      }, function(err) {
        fn(err);
      }).done();
  } catch (err) {
    fn(err);
  }
};
