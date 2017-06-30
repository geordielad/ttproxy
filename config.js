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
