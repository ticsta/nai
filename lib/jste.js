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
  options.resultFnName = options.resultFnName || '__result';
  options.locals = options.locals || {};

  return options;
}

var render = exports.render = module.exports.render = function(str, options) {

}

var compile = exports.compile = module.exports.compile = function(input, options) {
  var date = Date.now();
  options = initOptions(options);
  //input = JSON.stringify(input);
  //input = input.substr(1, input.length - 2);

  var root = new JsNode('', '', '', 0, 0);
  var finder = {
    start: options.start,
    end: options.end,
    reg: new RegExp(options.start + '([-=+]?)((?!' + options.end + ').)*' + options.end, 'i')
  };

  buildNode(root, input, finder, 0, 0);
  console.log('build nodes in: ', Date.now() - date);

  var code = ['var ' + options.resultFnName + ';'];
  code.push('\nwith (locals || {}) {');
  code.push('\n' + options.resultFnName + '=(function(){');
  buildCode(root, options, 0, 0, code);
  code.push('\n})();');
  code.push('\n}');
  code.push('\nreturn ' + options.resultFnName + ';');
  code = code.join('');
  //console.log('code: ', code);
  console.log('build code in: ', Date.now() - date);

  var fn = new Function('locals, escape, Promise', code);

  var fnResult = fn.call(options.scope || {}, options.locals, escape, Promise);

  //console.log(fnResult);

  return fnResult.then(function(result) {
    var html = buildHtml(result);
    console.log('TOTAL time: ', Date.now() - date);
    return html;
  });
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

function buildCode(node, options, depth, index, code) {
  var resultFnName = options.resultFnName;
  var stack = '__stack_' + depth;

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
    } else if (node.isClosing) {

      _code(node.code + ');');
    } else {
      _code(node.code);
    }
  }



  if (node.children && node.children.length > 0) {
    for (var i = 0; i < node.children.length; i++) {
      if (i == 0)
        _code('var __stack_' + (depth + 1) + '=[];');
      var child = node.children[i];
      buildCode(child, options, depth + 1, i, code);
      if (i == node.children.length - 1) {
        _code('return Promise.all(__stack_' + (depth + 1) + ')');
      }
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


compile('<div><% var temp="traier"; %><%- \'Ion\' %><%= "Vasile" %></div><%+ getUsers().then(function(result){ %><p><%= result %><%= temp %></p><% }) %><p><%= temp %></p></body>', {
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
