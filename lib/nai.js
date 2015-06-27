'use strict';

var Promise = require('bluebird'),
	JsNode = require('./node').JsNode,
	TextNode = require('./node').TextNode,
	Node = require('./node').Node,
	AsyncNode = require('./node').AsyncNode,
	readFileAsync = Promise.promisify(require('fs').readFile);

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
	options.rootNodeName = '__NAI__root_node';
	options.resultNodeName = '__NAI__result_node';
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
	if (options.debug) console.log(fn.toString());
	return fn(options.locals);
}

exports.compile = function(str, options) {
	return internalCompile(str, options);
}

function internalCompile(str, options) {
	//var date = Date.now();
	options = initOptions(options);
	var locals = options.locals,
		open = options.open,
		close = options.close;

	//str = str.replace(/\n/g, '\\n').replace(/'/g, "\\'"); // ?

	var root = new JsNode('', '?');
	var resultNodeId = Node.randomId();
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

	var code = [];

	code.push('var __NAI__' + resultNodeId + '=' + options.resultNodeName + ';');
	code.push(buildCodeBody(root, options, resultNodeId).join('\n'));
	code.push('return ' + options.resultNodeName + '.getResult();');

	code = code.join('\n');

	if (options.vm === true) {
		var vm = require('vm');
		var sandbox = {};
		sandbox[options.rootNodeName] = root;
		sandbox.escape = escape;
		sandbox.Promise = Promise;

		return function(locals) {
			sandbox[options.localsName] = locals;
			sandbox[options.resultNodeName] = new AsyncNode();
			var master = buildCodeMaster(options, locals);
			var completeCode = [master.header, code, master.footer].join('\n');
			if (options.debug) {
				console.log('=====================');
				console.log('code: ', completeCode);
				console.log('=====================');
			}
			return vm.runInNewContext(completeCode, sandbox);
		}
	} else {
		return function(locals) {
			var master = buildCodeMaster(options, locals);
			var completeCode = [master.header, code, master.footer].join('\n');
			if (options.debug) {
				console.log('=====================');
				console.log('code: ', completeCode);
				console.log('=====================');
			}
			var fn = new Function(options.localsName + ', ' + options.rootNodeName + ',' + options.resultNodeName + ', escape, Promise', 'return ' + completeCode);
			return fn.call(this, locals, root, new AsyncNode(), escape, Promise);
		}
	}
}

function buildCodeMaster(options, locals) {
	var code = [],
		localsParams = Object.keys(locals),
		result = {};
	code.push('(function(' + localsParams.join(',') + '){');
	code.push('"use strict";');
	result.header = code.join('\n');

	code = [];

	code.push('})(' + localsParams.map(function(param) {
		return options.localsName + '["' + param + '"]';
	}).join(',') + ');');

	result.footer = code.join('\n');

	return result;
}

//creating async stacks only...
function buildCodeBody(parent, options, resultNodeId, code, openedNodes) {
	code = code || [];
	openedNodes = openedNodes || [];

	var spaces = '';

	function getSpaces() {
		spaces = '';
		for (var i = 0; i < parent.depth; i++)
			spaces += '    ';
		return spaces;
	}
	getSpaces();


	parent.childs.forEach(function(node) {
		if (node.isText()) {
			code.push(spaces + '__NAI__' + resultNodeId + '.pushResult(' + options.rootNodeName + '.list["' + node.id + '"].inner);');
			return;
		}
		if (node.isAsync) {
			var newResultNode = new AsyncNode(node);
			code.push(spaces + '__NAI__' + resultNodeId + '.pushResult(' + node.code);
			code.push(spaces + '    var __NAI__' + newResultNode.id + ' = __NAI__' + resultNodeId + '.addNewChild();');
			openedNodes.push(node);
			node._id = newResultNode.id;
			return buildCodeBody(node, options, newResultNode.id, code, openedNodes);
		}
		var js = node.code.trim().replace(/[;]*$/, ''); // remove ; from code line end
		//js = js.replace(/\\'/g, '\'');
		if (node.method == '=') {
			code.push(spaces + '__NAI__' + resultNodeId + '.pushResult(escape(' + js + '));');
		} else if (node.method == '-') {
			code.push(spaces + '__NAI__' + resultNodeId + '.pushResult(' + js + ');');
		} else {
			var oNode = openedNodes.length > 0 ? openedNodes[openedNodes.length - 1] : null;
			if (node.isClosing) {
				if (oNode) {
					openedNodes.splice(openedNodes.length - 1, 1);
				}
				if (oNode && oNode.isAsync && !node.isOpening) {
					code.push(spaces + '    return __NAI__' + oNode._id + ';');
					code.push(spaces + node.code + ');');
				} else code.push(spaces + node.code);
			} else code.push(spaces + node.code);

			if (node.isOpening) {
				openedNodes.push(node);
			}

			if (node.childs.length > 0)
				buildCodeBody(node, options, resultNodeId, code, openedNodes);
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

	if (node.isOpening && !node.isClosing) {
		parent.addChild(node);
		return buildNodeTree(node, input, finder, root);
	}

	if (node.isClosing) {
		(parent.parent || parent).addChild(node);
		if (node.isOpening) {
			return buildNodeTree(node, input, finder, root);
		} else {
			return buildNodeTree((parent.parent || parent), input, finder, root);
		}
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

	if (cache[key]) {
		return exports.render(cache[key], options);
	}

	return readFileAsync(path, 'utf8').then(function(str) {
		if (options.cache)
			cache[key] = str;
		return exports.render(str, options);
	});
};


exports.__express = function(path, options, fn) {
	try {
		exports.renderFile(path, options)
			.then(function(result) {
				fn(null, result);
			}).error(fn);
	} catch (err) {
		fn(err);
	}
};
