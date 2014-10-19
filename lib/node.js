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

exports.TextNode = TextNode;
exports.JsNode = JsNode;