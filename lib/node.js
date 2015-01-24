var Promise = require('bluebird');

function Node(type, inner, depth) {
  this.type = type;
  this.inner = inner;
  this.depth = depth || 0;

  this.id = random();
}

Node.prototype.isText = function() {
  return this.type == 'text';
}

Node.prototype.isJs = function() {
  return this.type == 'js';
}

Node.prototype.addChild = function(node) {
  node.depth = this.depth + 1;
  node.parent = this;

  this.childs.push(node);
}

Node.prototype.print = function() {
  var tabs = '';
  for (var i = 0; i < this.depth; i++)
    tabs += '\t';

  console.log(this.depth + tabs + this.id + ': ' + (this.inner && this.inner.replace(/[\n\t]/g, '').replace(/ {2,}/g, ' ') || ''));

  this.childs && this.childs.forEach(function(node) {
    node.print();
  });
}

Node.prototype.setResult = function(result) {
  this.result = this.result || [];
  this.result.push(Promise.resolve(result));
}

Node.prototype.hasResult = function() {
  return this.result && this.result.length > 0;
}

Node.prototype.getResult = function(i) {
  var self = this;
  i = i || 0;
  return self.getSelfResult(i).then(function(result) {
    result = result || '';
    if (self.childsResults > 0 && i < self.childsResults) {
      var list = [];
      for (var j = i; j < self.childsResults; j++) list.push(j);
      return Promise.reduce(list, function(result, level) {
        return self.getChildsResult(level).then(function(cresult) {
          return result + cresult;
        });
      }, result);
    } else {
      return self.getChildsResult().then(function(cresult) {
        return result + cresult;
      });
    }
  });
}

Node.prototype.getSelfResult = function(i) {
  i = i || 0;
  if (this.result && this.result.length > i) {
    return this.result[i];
  }
  return Promise.resolve('');
}

Node.prototype.getChildsResult = function(i) {
  i = i || 0;
  if (this.childs && this.childs.length > i) {
    return Promise.reduce(this.childs, function(total, node) {
      return node.getResult(i).then(function(result) {
        if (result) total += result;
        return total;
      });
    }, '');
  }
  return Promise.resolve('');
}

/**
 * Text node
 */
function TextNode(inner) {
  Node.call(this, 'text', inner);
}

TextNode.prototype = new Node();

TextNode.prototype.setResult = function(result) {
  Node.prototype.setResult.call(this, result || this.inner);
}


/**
 * JsNode
 */
function JsNode(inner, method, code) {
  Node.call(this, 'js', inner);
  this.method = method;
  this.isAsync = method === '+' || method === '?';
  this.code = code;
  this.childs = [];

  if (code && code.length > 0) {
    var js = code.trim();
    this.isOpening = js.substr(js.length - 1, 1) == '{';
    this.isClosing = js.substr(0, 1) == '}';

    this.isAsync = this.isAsync || js.match(/\.(then|catch|error)\(function\s*\(/i);
  }
}

JsNode.prototype = new Node();


JsNode.prototype.closeChilds = function() {
  var childs = this.parent.childs;
  for (var i = 0; i < childs.length; i++) {
    var child = childs[i];
    if (child.id == this.id) {
      child = childs[i - 1];
      child.childsResults = child.childsResults || 0;
      child.childsResults++;
      break;
    }
  }
}

function getCollectionResult(collection, initial, i) {
  initial = initial || '';
  if (!collection || collection.length === 0) return Promise.resolve(initial);
  i = i || 0;
  return Promise.reduce(collection, function(value, node) {
    return node.getResult(i).then(function(result) {
      if (result) value += result;
      return value;
    });
  }, initial);
}

exports.TextNode = TextNode;
exports.JsNode = JsNode;
exports.Node = Node;

function random(l) {
  l = l || 12;
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  for (var i = 0; i < l; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function isString(obj) {
  return typeof obj === 'string';
}
