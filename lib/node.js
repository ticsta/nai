var Promise = require('bluebird');

function Node(type, inner, depth) {
  this.type = type;
  //this.inner = inner && inner.trim() || inner;
  this.inner = inner;
  this.depth = depth || 0;

  this.id = random();
}

Node.randomId = function() {
  return random();
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

/**
 * AsyncNode
 */
function AsyncNode(node) {
  Node.call(this, 'js', node && node.inner || '');
  this.method = node && node.method || '?';
  this.isAsync = true;
  this.code = node && node.code || null;
  this.childs = [];
}

AsyncNode.prototype = new Node();

AsyncNode.prototype.addNewChild = function(node) {
  node = new AsyncNode(node);
  node.depth = this.depth + 1;
  node.parent = this;

  this.childs.push(node);
  return node;
}

AsyncNode.prototype.pushResult = function(result) {
  var ref = this;
  ref.results = ref.results || [];

  ref.results.push(result);
}

AsyncNode.prototype.getResult = function() {
  var self = this;

  if (!self.results) return Promise.resolve('');

  var value = '';
  return Promise.resolve(self.results).each(function(result) {
    if ((result == null || result == undefined)) return;
    if (result.getResult) {
      return result.getResult().then(function(rresult) {
        value += rresult;
      });
    } else value += result;
  }).then(function() {
    return value;
  });
}

exports.TextNode = TextNode;
exports.JsNode = JsNode;
exports.AsyncNode = AsyncNode;
exports.Node = Node;

function random(l) {
  l = l || 16;
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  for (var i = 0; i < l; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function isString(obj) {
  return typeof obj === 'string';
}
