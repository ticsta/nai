
# Simple asynchronous template engine for node

Build for Asynchronous templates

## Usage

```
var nai = require('nai');

nai.render(str, options).then(function(output){
  // output
});

nai.renderFile(path, options).then(function(output){
  // output
});

var compiledFn = nai.compile('<html>', options);

compiledFn({title: 'Title 1'}).then(function(output){
  
});
compiledFn({title: 'Title 2'}).then(function(output){
  
});
```

## Example

```
<% if (user) { %>
  <h2><%= user.name %></h2>
<% } %>
<% db.getUsers().then(function(users){ %>
<div><%- users.length %> users</div>
<% }) %>
```
See examples folder.

## Syntax

1. `<% code %>` - any JavaScript code: `<% var title = 'My Title' %>` - no output;
2. `<%= variable %>` - Escapes html output;
3. `<%- variable %>` - Unescaped output;
3. `<% callAsync().then(function(... %>` - async block - works only with Promise.

## Options

- `debug` (Boolean) Output generated function body;
- `open` (String) Open tag, defaulting to "<%";
- `close` (String) Closing tag, defaulting to "%>";
- `locals` (Object) Template-local variables.
- `[vm](http://nodejs.org/api/vm.html#vm_vm_runinnewcontext_code_sandbox_filename)` (Boolean) Execute in a new context - more secure.


## License

The MIT License (MIT)

Copyright (c) 2014 Dumitru Cantea

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.