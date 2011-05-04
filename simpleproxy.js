require('./config.json');

var http = require('http'),
    url = require('url'),
    querystring = require('querystring');

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
    /* console.log("Route: " + config.routes[i].id);
    console.log("Regexp: " + config.routes[i]._re);
    console.log("Host: " + config.routes[i]._rewriteHost);
    console.log("Port: " + config.routes[i]._rewritePort);
    console.log("Path: " + config.routes[i]._rewritePath);
    console.log(parsedRewrite.pathname);
    console.log(parsedRewrite.search);
    console.log(parsedRewrite.hash);
    console.log();
    */
}

/**
 * Generate a very simple error page
 */
var createErrorPage = function(response, code, body) {
    response.writeHead(code, {'Content-Type': 'text/html'});
    response.write(body);
    response.end();
}

/**
 * check to see if this route has a mode parameter
 */
var hasMode = function(route, mode) {
    if (route.hasOwnProperty("modes") && route.modes instanceof Array) {
        return (route.modes.indexOf(mode) != -1);
    };
    return false;
}

http.createServer(function(request, response) {
    var proxy_request;
    var proxy = null;
    var jsonpFunction = null;
    try {
        var parsedURL = url.parse(request.url, parseQueryString=true);
        var pathRequest = parsedURL.pathname;
        console.log();
        console.log("base request path: " + pathRequest);
        if (Object.keys(parsedURL.query).length > 0) {
            pathRequest = pathRequest + "?" + querystring.stringify(parsedURL.query);
        }
        console.log("full path request: " + pathRequest);

        for (var i=0; i < config.routes.length; i++) {
            var route = config.routes[i];
            if (pathRequest.match(route._re) != null) {
                console.log("Found a match on route: " + config.routes[i].id);
                console.log("Base Request: " + pathRequest);
                console.log("New Host: " + route._rewriteHost + ":" + route._rewritePort);
                if (hasMode(route, "jsonp")) {
                    if (hasMode(route, "remove_jsonp_query") && parsedURL.query.hasOwnProperty("jsonp")) {
                        jsonpFunction = parsedURL.query.jsonp;
                        delete parsedURL.query.jsonp;
                    } else {
                        jsonpFunction = "parseRequest";
                    }
                }

                /* actually perform the rewriting of the URL. anything after this must NOT modify the URL */
                var baseRequest = parsedURL.pathname;
                if (Object.keys(parsedURL.query).length > 0) {
                    baseRequest = baseRequest + "?" + querystring.stringify(parsedURL.query);
                }
                var requestPath = baseRequest.replace(route._re, route._rewritePath);
                console.log("Rewrite Path: " + requestPath);

                if (hasMode(route, "p")) {
                    proxy = http.createClient(route._rewritePort, route._rewriteHost);
                    proxy_request = proxy.request(request.method, requestPath, request.headers);
                    break;
                } else {
                    createErrorPage(response, 500, "<h1>Unclear Directive</h1><p>I only understand proxy requests right now</p>");
                }
            }
        }

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
                if (jsonpFunction != null) { response.write(jsonpFunction + "(", 'binary'); }
                response.write(chunk, 'binary');
            });
            proxy_response.addListener('end', function() {
                if (jsonpFunction != null) { response.write(");", 'binary'); }
                response.end();
            });
            /* this probably should not assume utf-8 for the charset, but for now it works */
            if (jsonpFunction != null) {
                proxy_response.headers['content-type'] = "application/javascript;charset=utf-8";
                proxy_response.headers['content-length'] = proxy_response.headers['content-length'] + jsonpFunction.length + 3;
            }
            response.writeHead(proxy_response.statusCode, proxy_response.headers);
        });
        request.addListener('data', function(chunk) {
            proxy_request.write(chunk, 'binary');
        });
        request.addListener('end', function() {
            proxy_request.end();
        });
    } catch (err) {
        console.log('Uncaught Error: ' + err);
    }
}).listen(config.app.port, config.app.host);
