function Node(type, inner, lineno, index, depth) {
  this._type = type;
  this.inner = inner;
  this.lineno = lineno || 0;
  this.index = index || 0;
  this.depth = depth || 0;

  this.id = random();
}

function TextNode(inner, lineno, index, depth) {
  Node.call(this, 'text', inner, lineno, index, depth);
}

TextNode.prototype = new Node();

function JsNode(inner, type, code, lineno, index, depth) {
  Node.call(this, 'js', inner, lineno, index, depth);
  this.type = type;
  this.isAsync = type === '+';
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
  node.depth = this.depth + 1;
  node.parent = this;
  this.children.push(node);
}

exports.TextNode = TextNode;
exports.JsNode = JsNode;

function random(l) {
  l = l || 6;
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  for (var i = 0; i < l; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
