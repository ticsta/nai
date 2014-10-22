
# NAI - simple asynchronous templates for node

## Install

```
npm install nai;
```

## Example

```
<% if (user) { %>
  <h2><%= user.name %></h2>
<% } %>
<%+ db.getUsers().then(function(users){ %>
<div><%- users.length %> users</div>
<% }) %>
```
See examples folder.

## Syntax

1. `<% code %>` - any JavaScript code: `<% var title = 'My Title' %>`;
2. `<%= variable %>` - encoded output;
3. `<%- variable %>` - NOT encoded output;
3. `<%+ callAsync().then(... %>` - async block.