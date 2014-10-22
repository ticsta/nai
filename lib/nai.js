var Promise = require('bluebird'),
  JsNode = require('./node').JsNode,
  TextNode = require('./node').TextNode,
  Node = require('./node').Node,
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
  options.bufName = 'naiBUF__';
  options.locals = options.locals || {};

  Node.counter = 0;

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
    if (options.debug) {
      console.log('=====================');
      console.log('compile result: ', result);
      console.log('=====================');
    }
    return buildHtml(result);
  });
}

exports.compile = function(str, options) {
  //var date = Date.now();
  options = initOptions(options);
  var locals = options.locals,
    open = options.open,
    close = options.close;

  //str = JSON.stringify(str);
  //str = str.substr(1, str.length - 2);
  str = str.replace(/\n/g, '\\n').replace(/'/g, "\\'");

  var root = new JsNode('', '+', '', 0, 0);
  var finder = {
    open: open,
    close: close,
    reg: new RegExp(open + '([-=+]?)((?!' + close + ').)*' + close, 'i')
  };

  var maxAsyncDepth = buildNode(root, str, finder, 0, 0);
  if (options.debug) {
    console.log('=====================');
    console.log('max async depth: ', maxAsyncDepth);
    console.log('=====================');
  }
  var lastTextNode;
  root.children.forEach(function(node) {
    if (node._type == 'text') {
      if (!lastTextNode) lastTextNode = node;
      else lastTextNode = lastTextNode.order > node.order ? lastTextNode : node;
    }
  });

  //console.log('build nodes in: ', Date.now() - date);
  //if (options.debug)
  //  console.log('nodes: ', root.children);
  // root.children.forEach(function(item) {
  //   if (item.type == '+')
  //     console.log(item);
  // });

  //var localsNames = Object.keys(locals);

  var code = ['var ' + options.resultFnName + ';'];
  code.push('\nwith (locals || {}) {');
  code.push('\nvar ' + options.stackName + '=[];');
  code.push('\nvar ' + options.bufName + '={};');
  code.push('\nvar __last__order=' + lastTextNode.order + ';');
  code.push('\nvar __max__order=0;');
  code.push('function __apush(id, nid, result){\
var stack = ' + options.stackName + ';\
var buf = ' + options.bufName + ';\
var key=id+nid;\
if(buf[key]){\
  \n//console.log("adding to bufer: ", key, result);\
  \nbuf[key].push(result);\
}\
else{\
  \n//console.log("adding to stack: ", key, result);\
  \nstack.push(result);\
}\
\n__max__order = __max__order > result.order ? __max__order : result.order;}');
  code.push('\nvar __nai_resolver;');
  code.push('function __aend(id, nid){\
    var maxDepth = ' + maxAsyncDepth + ';\
    var stack = ' + options.stackName + ';\
    var buf = ' + options.bufName + ';\
    var key=id+nid;\
    if(buf[key]){\
      stack = ' + options.stackName + ' = stack.concat(buf[key]);\
      \n//console.log("deleting bufer: ", key);\
      \ndelete buf[key];\
    }\
    if(__max__order < __last__order || Object.keys(buf).length > 0) return;\
    \n//console.log("returing: ", __last__order, __max__order);\
    \n//console.log("stack:", stack);\
    \n//console.log("buf:", buf);\
    \n__nai_resolver(stack);}');

  code.push('function __aend__(){\
    var maxDepth = ' + maxAsyncDepth + ';\
    var stack = ' + options.stackName + ';\
    return new Promise(function(resolver){\
      __nai_resolver = resolver;\
      if(0 == maxDepth) resolver(stack);\
    });}');

  code.push('\nfunction __await(id, nid){\
var stack = ' + options.stackName + ';\
var buf = ' + options.bufName + ';\
var key=id+nid;\
\n//console.log("creating bufer: ", key);\
\nbuf[key] = buf[key] || [];}');
  code.push('\n' + options.resultFnName + '=(function(){');
  buildCode(root, options, code);
  code.push('\n})();');
  code.push('\n}');
  code.push('\nreturn ' + options.resultFnName + ';');
  code = code.join('');
  if (options.debug) {
    console.log('=====================');
    console.log('code: ', code);
    console.log('=====================');
  }
  //console.log('build code in: ', Date.now() - date);

  var fn = new Function('locals, escape, Promise', code);

  //var fnResult = fn.call(options.scope || {}, options.locals, escape, Promise);

  //console.log(fnResult);
  return function(locals) {
    return fn.call(this, locals, escape, Promise);
  };
}

//creating async stacks only...
function buildCode(node, options, code, waitingNode) {
  var resultFnName = options.resultFnName;
  var aNode = node.asyncParent || node;

  function _push(result) {
    _code('__apush("' + aNode.id + '", "' + (waitingNode || node).id + '", {order: ' + node.order + ', result: ' + result + '});');
  }

  function _code(line) {
    code.push('\n' + line);
  }

  function _Code(line) {
    code.push('\n' + line.replace(/\\n/g, '\n').replace(/\\'/g, '\''));
  }

  if (node._type == 'text') {
    _push("'" + node.inner + "'");
    return code;
  }

  if (node.code && node.code.trim().length > 0) {
    if (node.isAsync) {
      _Code('__await("' + aNode.id + '", "' + node.id + '")');
      waitingNode = node;
    }

    var js = node.code.trim();
    js = js[js.length - 1] == ';' ? js.substr(0, js.length - 1) : js;
    js = js.replace(/\\'/g, '\'');

    if (node.type == '-') {
      _push(js);
    } else if (node.type == '=') {
      _push('escape(' + js + ')');
    } else {
      _Code(node.code);
    }
  }



  if (node.children && node.children.length > 0) {
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      buildCode(child, options, code, waitingNode);
    }
    if (node.isAsync && !node.asyncParent)
      _Code('return __aend__()');
    else if (node.isAsync)
      _Code('__aend("' + aNode.id + '", "' + waitingNode.id + '")');
  }

  return code;
}

function buildHtml(result, html) {
  var html = '';
  result.sort(function(a, b) {
    return a.order - b.order
  });
  result.forEach(function(item) {
    html += item.result;
  });
  return html;
}

function buildNode(root, input, finder, lineno, index, parent, adepth) {

  var result = finder.reg.exec(input);
  adepth = adepth || 0;

  if (!result) {
    (parent || root).addChild(new TextNode(input, lineno, index));
    return adepth;
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
  if (node.isAsync) adepth++;

  input = input.substr(result.index + result[0].length);

  if (node.isClosing) {
    parent.addChild(node);
    return buildNode(parent, input, finder, lineno, index, parent.parent, adepth);
  }

  root.addChild(node);

  if (node.isOpening) {
    return buildNode(node, input, finder, lineno, index, root, adepth);
  }

  if (input.length > 0) {
    return buildNode(root, input, finder, lineno, index, parent, adepth);
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
