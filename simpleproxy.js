require('./config.json');

var http = require('http'),
    url = require('url');

var COUCHDB_PREFIX = "/couchdb";

/**
 * before doing anything else, compile all of the regexps and process
 * all of the paths into their constiuent parts
 */
for (var i=0; i < config.routes.length; i++) {
    config.routes[i]._re = new RegExp(config.routes[i].match);
    var parsedRewrite = url.parse(config.routes[i].rewrite, parseQueryString=true);
    config.routes[i]._rewriteHost = parsedRewrite.hostname;
    config.routes[i]._rewritePort = parsedRewrite.port;
    config.routes[i]._rewritePath = parsedRewrite.pathname + parsedRewrite.search;
    console.log("Route: " + config.routes[i].id);
    console.log("Regexp: " + config.routes[i]._re);
    console.log("Host: " + config.routes[i]._rewriteHost);
    console.log("Port: " + config.routes[i]._rewritePort);
    console.log("Path: " + config.routes[i]._rewritePath);
    console.log(parsedRewrite.pathname);
    console.log(parsedRewrite.search);
    console.log(parsedRewrite.hash);
    console.log()
}

/**
 * Generate a very simple error page
 */
var createErrorPage = function(response, code, body) {
    response.writeHead(code, {'Content-Type': 'text/html'});
    response.write(body);
    response.end();
}

http.createServer(function(request, response) {
  var proxy_request;
  var proxy = null;
  try {
    var path = url.parse(request.url).pathname;
    for (var i=0; i < config.routes.length; i++) {
        if (path.match(config.routes[i]._re) != null) {
            console.log("Found a match on route: " + config.routes[i].id);
            console.log("Request: " + path);
            console.log("New Host: " + config.routes[i]._rewritePort + ":" + config.routes[i]._rewriteHost);
            console.log("Rewrite: " + path.replace(config.routes[i]._re, config.routes[i]._rewritePath));
            proxy = http.createClient(config.routes[i]._rewritePort, config.routes[i]._rewriteHost);
            proxy_request = proxy.request(request.method, path.replace(config.routes[i]._re, config.routes[i]._rewritePath), request.headers);
            break;
        }
    }
    /*
    if (path.substr(0, COUCHDB_PREFIX.length) === COUCHDB_PREFIX) {
          console.log("couchdb: " + path);
          proxy = http.createClient(5984, "localhost");
    } else {
          console.log("tomcat: " + path);
          proxy = http.createClient(8080, "localhost");
          proxy_request = proxy.request(request.method, request.url, request.headers);
    }*/
    if (proxy == null) {
        createErrorPage(response, 500, "<h1>No Route Found</h1>");
        return;
    }

    proxy.addListener('error', function(connectionException) {
      if (connectionException.errno === 61) {
        console.log("ECONNREFUSED: connection refused to " + proxy.host + ":" + proxy.port);
        createErrorPage(response, 504, "<h1>504 Gateway Timeout</h1><p>Received a ECONNREFUSED commecting to " + proxy.host + ":" + proxy.port + ". This usually means the remote server was not responding.</p>");
        return;
      } else {
        console.log("Uncaught exception: " + connectionException);
        createErrorPage(response, 500, "<h1>500 Internal Server Error</h1><p>Received an unhandled exception:</p><pre>" + connectionException + "</pre>");
        return;
      }
    });

    proxy_request.addListener('response', function (proxy_response) {
      proxy_response.addListener('data', function(chunk) {
        response.write(chunk, 'binary');
      });
      proxy_response.addListener('end', function() {
        response.end();
      });
      response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });
    request.addListener('data', function(chunk) {
      proxy_request.write(chunk, 'binary');
    });
    request.addListener('end', function() {
      proxy_request.end();
    });
  }
  catch (err) {
    console.log('Uncaught Error: ' + err);
  }
}).listen(config.app.port, config.app.host);
