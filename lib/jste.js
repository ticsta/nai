var Promise = require('bluebird');

function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};

function noEscape(html) {
  return String(html)
    .replace(/'/g, '&#39;');
};

function initOptions(options) {
  options = options || {};
  options.start = options.start || '<%';
  options.end = options.end || '%>';
  options.resultFnName = options.resultFnName || 'jste__result__';
  options.locals = options.locals || {};

  return options;
}

var render = exports.render = module.exports.render = function(str, options) {

}

var compile = exports.compile = module.exports.compile = function(input, options) {
  options = initOptions(options);
  input = JSON.stringify(input);
  input = input.substr(1, input.length - 2);

  var root = new JsNode('', '', '', 0, 0);
  var finder = {
    start: options.start,
    end: options.end,
    reg: new RegExp(options.start + '([-=]?)((?!' + options.end + ').)*' + options.end, 'i')
  };

  buildNode(root, input, finder, 0, 0);

  var code = 'var ' + options.resultFnName + '=[];';
  code += '\nwith (locals || {}) { (function(){'

  return Promise.resolve(buildCode(root, options, 0, 0, '')).then(function(cd) {
    code += cd;
    code += '\n})();';
    code += '\n}';
    code += '\nreturn ' + options.resultFnName + ';';
    //console.log('code: ', code);

    var fn = new Function('locals, escape', code);

    var fnResult = fn.call(options.scope || {}, options.locals, escape);

    //console.log(fnResult);

    return Promise.resolve(fnResult).then(function(result) {
      return result;
    });
  });
}

function buildCode(node, options, depth, index, code) {
  var resultFnName = options.resultFnName;

  if (node._type == 'text') {
    code += '\n' + resultFnName + '.push({result:\'' + node.inner + '\',depth: ' + depth + ',index: ' + index + '});\n';
    return code;
  }

  if (node.code && node.code.trim().length > 0) {
    var js = node.code.trim();
    js = js[js.length - 1] == ';' ? js.substr(0, js.length - 1) : js;

    if (node.type == '-') {
      code += '\n' + resultFnName + '.push({result:\'' + noEscape(js) + '\',depth: ' + depth + ',index: ' + index + '});\n';
    } else if (node.type == '=') {
      code += '\n' + resultFnName + '.push({result:\'' + escape(js) + '\',depth: ' + depth + ',index: ' + index + '});\n';
    } else
      code += node.code;
  }

  if (node.children && node.children.length > 0) {
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      code += buildCode(child, options, depth + 1, i, '');
    }
  }

  return code;
}

function buildNode(root, input, finder, lineno, index, parent) {

  var result = finder.reg.exec(input);

  if (!result) {
    root.addChild(new TextNode(input, lineno, index));
    return;
  }

  var inner = result[0];
  var type = result[1];
  var code = inner.substr(finder.start.length + type.length);
  code = code.substr(0, code.length - finder.end.length);

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
    return buildNode(parent, input, finder, lineno, index);
  }

  root.addChild(node);

  if (node.isOpening) {
    return buildNode(node, input, finder, lineno, index, root);
  }

  if (input.length > 0) {
    return buildNode(root, input, finder, lineno, index, parent);
  }
}

function Node(type, inner, lineno, index) {
  this._type = type;
  this.inner = inner;
  this.lineno = lineno;
  this.index = index;
}

function TextNode(inner, lineno, index) {
  Node.call(this, 'text', inner, lineno, index);
}

TextNode.prototype = new Node();

function JsNode(inner, type, code, lineno, index) {
  Node.call(this, 'js', inner, lineno, index);
  this.type = type;
  this.code = code;
  //this.closeNode = closeNode;
  this.children = [];
  if (code && code.length > 0) {
    var js = code.trim();
    this.isOpening = js.substr(js.length - 1, 1) == '{';
    this.isClosing = js.substr(0, 1) == '}';
  }
}

JsNode.prototype = new Node();

JsNode.prototype.addChild = function(node) {
  this.children.push(node);
}

JsNode.prototype.setCloseNode = function(node) {
  this.closeNode = node;
}


compile('<div><%- \'Ion\' %><% setTimeout(function(){ %><%= "hello" %><% }, 100) %></div>').then(function(result) {
  console.log(result);
});
