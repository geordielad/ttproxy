# Tableau Trusted Ticket Agent and Reverse Proxy
## Description
This example implements a Server Side Trusted Ticket Agent for Tableau. It will Request and Redeem a Trusted Ticket all on the Server. It is designed to work in scenarios where you need to integrate Tableau SSO with external Access Management Systems (like CA Single Sign-On/Siteminder) and when SAML is not an option.

This example uses Unrestricted Tickets but it will work with regular Trusted Tickets where Tableau Views are embedded in other web applications.

The example configuration below should work on a non-SSL enabled Tableau Server with this agent and a Mock Authentication Server all on localhost. You do not need an external Access Management System. By deploying the various components on separate server and setting the config options appropriately you should be able to integrate this package in more complex environments. In a production environment you would not need the Mock Authentication Service and you might call login-to-tableau-server directly with the username in a header (hence the example code to encrypt/decrypt the username)

This example comes with the ability to encrypt the username when passing it from the mock-auth-server to ttproxy. This functionality uses an RSA Public/Private key encryption/decryption package called URSA (See https://github.com/quartzjer/ursa). The package.json, requires and config.js by default are set up not to require a successful URSA install. If you do want username encryption then you will need to configure your system so that URSA is successfully installed then you can change the encUsernameFlag in config.js on both packages.

## Usage

```bash
$ git clone https://github.com/geordielad/ttproxy.git
$ cd ttproxy
$ npm install # Assumes ursa can build successfully
$ # Make changes to config.js as needed. Add SSL key/cert if needed. Enable Encryption of username
$ npm start
```

## Example - localhost, non-SSL, no Encryption of username

1. Install this package and https://github.com/geordielad/tt-mock-auth-server.git
2. Enable Unrestricted Trusted Tickets on Tableau Server and configure trust and gateway settings
```bash
    tabadmin stop
    tabadmin set wgserver.unrestricted_ticket true
    tabadmin set gateway.trusted 127.0.0.1
    tabadmin set gateway.public_host localhost
    tabadmin set gateway.public_port 8000
    tabadmin set wgserver.trusted_hosts "127.0.0.1"
    tabadmin config
    tabadmin start
```
3. Create a user (default is rcottiss@tableau.rocks) on Tableau or edit config.js to use another user.
4. Configure port and hostname settings for Proxy and Auth Server
    - Sample assumes http, localhost (for all Tableau, Proxy and Auth Server) and 8000 for the proxy and 8080 for the auth server.
5.	In a command window
```bash
    cd tt-mock-auth-server
    npm start
```
6. In another command window
```bash
    cd ttproxy
    npm start
```
7.	In your web browser go to proxy server public address (e.g. http://localhost:8000)

### config.js used in this package

```javascript

module.exports = {
    name: 'Tableau Trusted Ticket Requester and Pre-Auth Reverse Proxy',
    protocol: process.env.PROTOCOL || 'http', // http or https
    sslKeys: {
      key: '.ssl/private-ssl-key.key',
      cert: '.ssl/public-ssl-cert.pem'
    },
    port: process.env.PORT || 8000, // Any available port
    encUsernameFlag: false,
    encKeys: {
      key: '.enc/private-enc-key.key',
      cert: '.enc/public-enc-cert.pem'
    },
    tableauServer: 'http://localhost',
    authServer: 'http://localhost:8080/login'
};

```

## Authors

| [!["Robin Cottiss"](http://gravatar.com/avatar/b7ccc70dfdbfc700d88c1ca246fa4946.png?s=60)](http://tableau.com "Robin Cottiss <rcottiss@tableau.com>") |
|---|
| [@geordielad](https://twitter.com/geordielad) |

## Is this example supported?

This example is made available AS-IS with no support and no warranty whatsoever. The software is strictly “use at your own risk.”

The good news: You are free to modify it in any way to meet your needs, or use it as the basis for your own implementation.

## License

Licensed under the MIT license
