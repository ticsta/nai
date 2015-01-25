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

  node.parentAsync = this.isAsync ? this : this.parentAsync;

  this.childs.push(node);
}

// utility for debug
Node.prototype.print = function() {
  var tabs = '';
  for (var i = 0; i < this.depth; i++)
    tabs += '\t';

  console.log(this.depth + tabs + this.id + ': ' + (this.inner && this.inner.replace(/[\n\t]/g, '').replace(/ {2,}/g, ' ') || ''));

  this.childs && this.childs.forEach(function(node) {
    node.print();
  });
}

Node.prototype.pushResult = function(result) {
  var ref = this.parentAsync;
  ref.results = ref.results || [];
  ref.results.push({
    data: Promise.resolve(result || this.inner),
    asyncNode: this.isAsync ? this : null
  });
}

Node.prototype.getResult = function() {
  var self = this;

  if (self.results) {
    return Promise.reduce(self.results, function(value, result) {
      return result.data.then(function(nresult) {
        if (nresult) value += nresult;
        if (result.asyncNode) {
          return result.asyncNode.getResult().then(function(nvalue) {
            if (nvalue) value += nvalue;
            return value;
          });
        }
        return value;
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
