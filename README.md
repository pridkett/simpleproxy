# simpleproxy
Cross-domain security got your web development down? Welcome to simpleproxy
where you get possible instability in exchange for a way to workaround those
nasty security issues.

## In Brief
The simplest way to understand and think about simpleproxy is as a very
lightweight [mod\_rewrite][mrw] wannabe. [mod\_rewrite][mrw] is an amazing piece of
software, however it requires that you run [Apache][apache], which is heavy weight and
often more than you need for simple web development. Unlike the [Apache][apache]/[mod\_rewrite][mrw]
combination, simpleproxy does not serve any content, so all requests will
be proxied to some other server.

Upon receiving a request simpleproxy sequentially processes a set of routes
looking looking for a regular expression that matches the request. When it
finds a route that matches it rewrites the URL and performs a request to the
server, passing through all of the headers. It's kinda dumb about how it does
this and does do anything smart like add the X-Forwarded-For header, but hey,
it's good enough for my development.

## Sample Routes

Redirect anything that starts with /couchdb/ to an underlying CouchDB server
running on port 5984, but remove the string CouchDB:

    { id: "couchdb", match: "^/couchdb/?(.*)$", rewrite: "http://localhost:5984/$1", modes: ["p"] }

Redirect anything that starts with /jsonp/ to an underlying CouchDB server and
wrap the request in a callback to the default [JSONP][jsonp] callback function of parseRequest.
This will also modify the outgoing content-type header to application/javascript.

    { id: "jsonp", match: "^/jsonp/(.*)$", rewrite: "http://localhost:5984/$1", modes: ["p","jsonp"] }

Same as above, but allow the client to specify the JSONP function name by attaching
jsonp=newFunctionName to the query. This also prevents the jsonp query parameter from
being passed to the underlying couchdb server.

    { id: "jsonp", match: "^/jsonp/(.*)$", rewrite: "http://localhost:5984/$1", modes: ["p","jsonp","remove_jsonp_query"] }

Proxy PNG, JPG, and GIF requests in an images directory to a server on Amazon's S3.

    { id: "images", match: "/images/([^/]+\.(png|jpg|gif))" rewrite: "http://myimages.s3.amazon.com/$1", modes: ["p"] }

Pass all requests through to a local server running on port 8080. This is often useful
as the final catch all rule. Requests that don't match a rule throw an error.

    { id: "default", match: "^(.*)$", rewrite: "http://localhost:8080$1", modes: ["p"] }

## Things Left to Do

 * Rule chaining does not yet work. Therefore, all rules must currently have the "p" mode set.
 * Addition of conditions similar to RewriteCond in [mod\_rewrite][mrw]
 * Add handler functions to proxy responses. This would give the proxy the ability to dynamically
 rewrite content on the fly.
 * Send the X-Forwarded-For header and other appropriate headers.

## Contact Information

Got more questions? Find me on github as [pridkett][ghpridkett].

 [mrw]: http://httpd.apache.org/docs/current/mod/mod_rewrite.html
 [apache]: http://httpd.apache.org/
 [jsonp]: http://en.wikipedia.org/wiki/JSONP
 [ghpridkett]: https://github.com/pridkett
