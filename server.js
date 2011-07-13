#! /usr/bin/env node
options = require("nomnom").opts({
    host: {
        string: "-H HOST, --host=HOST",
        default: "127.0.0.1",
        help: "Host to serve at. (Default: 127.0.0.1)"
    },
    port: {
        string: "-p PORT, --port=PORT",
        default: 8080,
        help: "HTTP port to serve at. (Default: 8080)"
    },
    basePath: {
        string: "-b PATH, --base-path=PATH",
        default: "./",
        help: "Base path to serve from. (Default: ./)"
    },
    configFile: {
        string: "-c PATH, --config-file=PATH",
        default: false,
        help: "Configuration file for the server. (Default: none)"
    }
}).parseArgs();
var nttpd = require("nttpd");
nttpd.listen(options);