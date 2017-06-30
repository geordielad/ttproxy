
  var httpProxy = require('http-proxy');
  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser');
  var cookieParser = require('cookie-parser');
  var request = require('request');
  var fs = require('fs');
  var https = require('https');
  var http = require('http');
  var ursa = require('ursa');
  var urlencode = require('urlencode');
  var util = require('util');

  var config = require('./config');

  var sslCredentials = {};

  if (config.protocol == 'https') {
    var sslPrivateKey  = fs.readFileSync(config.sslKeys.key, 'utf8');
    var sslCertificate = fs.readFileSync(config.sslKeys.cert, 'utf8');

    sslCredentials = {key: sslPrivateKey, cert: sslCertificate};

    var httpsServer = https.createServer(sslCredentials, app);

    var server = httpsServer.listen(config.port, function () {
      console.log('HTTPS Auth server listening on port '+config.port);
    });
  }
  else {
    var httpServer = http.createServer(app);

    var server = httpServer.listen(config.port, function () {
      console.log('HTTP Auth server listening on port '+config.port);
    });
  }

  if (config.encUsernameFlag) {
    var encPrivateKey = fs.readFileSync(config.encKeys.key, 'utf8');
    //var encPublicKey = fs.readFileSync(config.encKeys.cert, 'utf8');

    var ursaKey = ursa.createPrivateKey(encPrivateKey);
    //var ursaCrt = ursa.createPublicKey(encPublicKey);

  }

  var proxy = httpProxy.createProxyServer({
    ssl: sslCredentials,
    xfwd: true,
    //changeOrigin: true
  });

  proxy.on('proxyReq', function(proxyReq, req, res, options) {
    //console.log('proxyReq');
    //proxyReq.setHeader('X-Forwarded-Host', 'ttproxy.tableau.rocks');
    //proxyReq.setHeader('X-Forwarded-Proto', 'https');
    //proxyReq.setHeader('TEST', 'BLA');
    //proxyReq.setHeader('x-forwarded-for', '1.1.1.1');
    //console.log('req.headers:',util.inspect(req.headers, {showHidden: false, depth: null}))
    //console.log('proxyReq:',util.inspect(proxyReq, {showHidden: false, depth: null}))
  });

  //var tableauServer = 'http://localhost:81';
  //var tableauServer = 'https://tableau10.tableau.rocks';
  //var authServer = 'https://auth-service.tableau.rocks:8443/login';
  var tableauServer = config.tableauServer;
  var authServer = config.authServer;
  //var authServer = 'https://auth-service.tableau.rocks:8443?host=ttproxy.tableau.rocks&site=default';

  /**
  * The root url will test for session status and redirect to third party auth server if there is
  * no Tableau Server session
  */
  app.get('/', function(req, res) {
    var tableauServerCookies = req.get('cookie');
    getSessionInfoStatusCode(tableauServerCookies, function(statusCode) {
      if (statusCode === 401) {
        // We need to get a Tableau Server session!

        // Step 1: The customer's proxy will need to authenticate the user with their own auth system, get the
        // Tableau Server username and site, and use those to get a trusted ticket. How this happens depends on the
        // customer's proxy and authentication service. For the purpose of this POC, I'm going to assume we
        // 302 to a third party auth service, then that third party auth service redirects to a special proxy
        // url that will get a trusted ticket for a user.

        res.redirect(authServer+'?host='+req.hostname+'&proto='+req.protocol+'&port='+((req.protocol == 'http') ? app.get('http_port') : app.get('https_port')));
      } else {
        //console.log(util.inspect(req.headers, {showHidden: false, depth: null}))

        proxy.web(req, res, {target: tableauServer});
      }
    })
  });

  /**
  * The site url will test for session status and redirect to third party auth server if there is
  * no Tableau Server session
  */

  /**
  * This is a proxy-specific url that will sign in the given username using unrestricted trusted tickets.
  * Of course, this is completely insecure since the username is plain text, but the customer could
  * use some form of encryption here. This might not be needed in the customer's implementation depending
  * on how the customer authenticates the user and gets their Tableau Server username back to the proxy.

  * This route takes an optional `redirect` query parameter and an optional `site` query parameter, e.g.
  * http://localhost//login-to-tableau-server/workgroupuser?redirect=/#/workbooks&site=blah
  */
  app.get('/login-to-tableau-server/:username', function(req, res) {

    if (config.encUsernameFlag) {
      tableauServerUsername = ursaKey.decrypt(urlencode.decode(req.params.username), 'base64', 'utf8');
    }
    else {
      tableauServerUsername = req.params.username;
    }

    // Use the default site if the caller did not specify a site
    console.log('req.query.proxySite: ',req.query.proxySite)

    var site = req.query.proxySite || '';

    getTrustedTicketForUser(tableauServerUsername, site, function(ticket) {
      console.log('got trusted ticket', ticket);

      // Step 3: exchange the trusted ticket for a tableau server session
      exchangeTrustedTicketForSessionCookies(ticket, site, function(tableauSessionCookies) {
        console.log('trusted ticket exchanged for cookies: ', tableauSessionCookies);

        // Step 4: Put the session cookies in the response to the browser
        tableauSessionCookies.forEach(function(cookie) {
          res.append('Set-Cookie', cookie);
        })

        // Step 5: redirect the user to the given redirect url or the site disambiguator
        // The customer could choose any page for this
        console.log('req.query.redirect: ',req.query.redirect);
        res.redirect(req.query.redirect || '/#/site');
        //res.redirect('/#/site');

      });
    });
  });

  // The /signin request must redirect to root so it doesn't load the signin page
  app.get('/signin', function(req, res) {

    // Test for disableAutoSignin so we do not go back to Tableau.
    if (req.query.disableAutoSignin == 'yes') {
      res.redirect('/logout');
    }
    else {
      res.redirect('/');
    }
  });

//
  app.get('/logout', function(req, res) {
    res.send('<p>Logged Out</p>');
  });

  // If the user clicks the vizportal Sign Out Menu Item they will be POSTed here. We do not want to re-authenticate automatically
  //app.post('/vizportal/api/web/v1/logout', function(req, res) {
    // Proabably want to redirect to an external Sign In or Logged Put Page
  //  console.log('req.originalUrl: ',req.originalUrl)
  //  res.redirect('http://tableau.com')
  //});


  app.all('/*', function(req, res) {
    //console.log('req.originalUrl: ',req.originalUrl)
    proxy.web(req, res, {target: tableauServer});
  });

  /**
  * Takes the session cookies, and uses those to make a getSessionInfo request to see if the
  * session is valid.
  *
  * Calls callback(false) if getSessionInfo returns a 401, otherwise returns true. Note that
  * this returns true even if the server is down
  */
  function getSessionInfoStatusCode(cookies, callback) {
    //extract the xsrf token from the cookies. We must set the 'X-XSRF-TOKEN' header to this value.
    var xsrfTokenMatch = cookies ? cookies.match(/XSRF-TOKEN=([^;]*)/) : null;
    var xsrfToken = xsrfTokenMatch ? xsrfTokenMatch[1] : '';
    var getSessionInfoRequestOptions = {
      url: tableauServer + '/vizportal/api/web/v1/getSessionInfo',
      json: true,
      body: {
        method: 'getSessionInfo',
        params: {}
      },
      headers: {
        cookie: cookies,
        'X-XSRF-TOKEN': xsrfToken
      }
    };
    request.post(getSessionInfoRequestOptions, function(err, httpResponse, body) {
      console.log('getSessionInfo returned', httpResponse.statusCode);
      callback(httpResponse.statusCode);
    });
  }

  /**
  * Calls callback(trusted ticket) once we have a trusted ticket
  */
  function getTrustedTicketForUser(username, site, callback) {
    var tabservUrl = '';
    if (site != '') {
      tabservUrl = tableauServer  + '/trusted?target_site=' + site;
    }
    else {
      tabservUrl = tableauServer  + '/trusted';
    };

    console.log('tabservUrl',tabservUrl);
    console.log('username',username);

    var trustedTicketRequestOptions = {
      url: tabservUrl,
      form: {
        username: username
      }
    };
    console.log('trustedTicketRequestOptions.url',trustedTicketRequestOptions.url);
    request.post(trustedTicketRequestOptions, function(err, httpResponse, body) {
      var trustedTicket = body;
      console.log('body',body);
      if (trustedTicket === '-1') {
        return console.error('uh... sumpin went wrong with trusted ticket request. Returned `-1`');
      }
      callback(trustedTicket);
    });
  }

  /**
  * Redeems the trusted ticket for a session token. Calls callback(set-cookie_headers)
  */
  function exchangeTrustedTicketForSessionCookies(ticket, site, callback) {
    var siteSuffix = site ? '/t/' + site : '';
    var trustedTicketUrl = tableauServer + '/trusted/' + ticket + siteSuffix;
    request.get(trustedTicketUrl, {followRedirect: false}, function(err, httpResponse, body) {
      var setCookieHeaders = httpResponse.headers['set-cookie'];
      callback(setCookieHeaders);
    });
  }

  function isString(potentialString) {
    return typeof potentialString === 'string' || potentialString instanceof String;
  }
