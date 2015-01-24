'use strict';

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
	options.nodeFnName = '__NAI__node_resolve';
	options.rootNodeName = '__NAI__root_node';
	options.localsName = '__NAI__locals';
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
		return result;
	});
}

exports.compile = function(str, options) {
	//var date = Date.now();
	options = initOptions(options);
	var locals = options.locals,
		open = options.open,
		close = options.close;

	//str = str.replace(/\n/g, '\\n').replace(/'/g, "\\'"); // ?

	var root = new JsNode('', '?');
	root.list = {};
	var finder = {
		open: open,
		close: close,
		reg: new RegExp(open + '([-=+\\?]?)([\\s\\S]*?)' + close, 'i')
	};

	// build node tree for 'str'
	buildNodeTree(root, str, finder);
	root.list[root.id] = root;

	if (options.debug) {
		console.log('=====================');
		console.log('nodes: ');
		console.log(root.print());
		console.log('=====================');
	}

	var localsParams = Object.keys(locals);
	var code = [];

	// start main function
	code.push('return (function(' + localsParams.join(',') + '){');

	// start node traversing
	code.push(buildCode(root, options).join('\n'));

	code.push('return ' + options.rootNodeName + '.getResult();');

	// end & call main function with locals
	code.push('})(' + localsParams.map(function(param) {
		return options.localsName + '["' + param + '"]';
	}).join(',') + ');');

	code = code.join('\n');

	if (options.debug) {
		console.log('=====================');
		console.log('code: ', code);
		console.log('=====================');
	}

	// create executing function
	var fn = new Function(options.localsName + ', ' + options.rootNodeName + ', escape, Promise', code);

	//console.log('build code in: ', Date.now() - date);

	return function(locals) {
		return fn.call(this, locals, root, escape, Promise);
	};
}

//creating async stacks only...
function buildCode(parent, options, code, openedNodes, asyncOpenedNodes) {
	code = code || [];
	openedNodes = openedNodes || [];
	asyncOpenedNodes = asyncOpenedNodes || [];

	parent.childs.forEach(function(node) {
		if (node.isText()) {
			code.push(options.rootNodeName + '.list["' + node.id + '"].setResult()');
			return;
		}
		if (node.isAsync) {
			code.push(options.rootNodeName + '.list["' + node.id + '"].setResult(' + node.code);
			asyncOpenedNodes.push(node);
			return buildCode(node, options, code, openedNodes, asyncOpenedNodes);
		}
		var js = node.code.trim().replace(/[;]*$/, ''); // remove ; from code line end
		//js = js.replace(/\\'/g, '\'');
		if (node.method == '=') {
			code.push(options.rootNodeName + '.list["' + node.id + '"].setResult(escape(' + js + '));');
		} else if (node.method == '-')
			code.push(options.rootNodeName + '.list["' + node.id + '"].setResult(' + js + ');');
		else {
			var oNode;
			if (node.isClosing) {
				oNode = openedNodes.length > 0 ? openedNodes[openedNodes.length - 1] : null;
				if (oNode && node.depth == oNode.depth) {
					openedNodes.splice(openedNodes.length - 1, 1);
					code.push(options.rootNodeName + '.list["' + node.id + '"].closeChilds();');
				}
			}

			oNode = asyncOpenedNodes.length > 0 ? asyncOpenedNodes[asyncOpenedNodes.length - 1] : null;
			if (oNode && node.isClosing && !node.isOpening && node.depth == oNode.depth) {
				code.push(node.code + ');');
				asyncOpenedNodes.splice(asyncOpenedNodes.length - 1, 1);
			} else code.push(node.code);

			if (node.isOpening) {
				openedNodes.push(node);
			}

			if (node.childs.length > 0)
				buildCode(node, options, code, openedNodes, asyncOpenedNodes);
		}
	});

	return code;
}

function buildNodeTree(parent, input, finder, root) {
	root = root || parent;
	var result = finder.reg.exec(input),
		node;

	if (!result) {
		node = new TextNode(input);
		parent.addChild(node);

		root.list[node.id] = node;
		return;
	}

	var inner = result[0];
	var method = result[1];
	var code = inner.substr(finder.open.length + method.length);
	code = code.substr(0, code.length - finder.close.length);

	if (result.index > 0) {
		var s = input.substr(0, result.index);
		node = new TextNode(s);
		parent.addChild(node);

		root.list[node.id] = node;
	}

	node = new JsNode(inner, method, code);

	root.list[node.id] = node;

	input = input.substr(result.index + result[0].length);

	if (node.isOpening) {
		parent.addChild(node);
		return buildNodeTree(node, input, finder, root);
	}

	if (node.isClosing) {
		(parent.parent || parent).addChild(node);
		return buildNodeTree((parent.parent || parent), input, finder, root);
	}

	parent.addChild(node);

	if (input.length > 0) {
		buildNodeTree(parent, input, finder, root);
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
