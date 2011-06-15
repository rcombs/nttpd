#!/usr/bin/env node
var fs = require("fs"),
    http = require("http"),
    url = require('url'),
    path = require("path"),
    mime = require("mime"),
    vm = require("vm"),
    lib = require("./lib/all.js");
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
            default: "",
            help: "Configuration file for the server. (Default: none)"
        }
    }).parseArgs();
mime.define({"application/node": ["njs"]});
var handlers = {
    "text/plain": function(req,res,type){
        fs.readFile(path.join(options.basePath,decodeURIComponent(req.url)),
            function(err,data){
                if(!err){
                    res.writeHead(200, {'Content-Type': type});
                    res.end(data);
                }else{
                    res.writeHead(500,err.message, {"Content-Type": "text/html"});
                    lib.servePageForError(err,req,res);
                }
            }    
        );
    },
    "application/javascript":"text/plain",
    "application/node": function(req,res,type){
        var global = {
            headers: {},
            require: require
        };
        global.echo = function(text){
            if(!global.headersSent){
                res.writeHead(200,global.headers);
                global.headersSent = true;
            }
            res.write(text);
        };
        global.setHeader = function(name,value){
            global.headers[name] = value;
        };
        global.global = global;
        fs.readFile(path.join(options.basePath,decodeURIComponent(req.url)),"utf-8",function(err,data){
            vm.runInNewContext(data,global,path.join(options.basePath,decodeURIComponent(req.url)));
            res.end();
        });
    }
};
function runHandlerForType(type,req,res,otype){
    if(!handlers[type]){
        runHandlerForType("text/plain",req,res,"text/plain");
    }else if(typeof handlers[type] == "string"){
        runHandlerForType(handlers[type],req,res,otype);
    }else{
        handlers[type](req,res,otype);
    }
}
function evalRequest(req,res){
    var url = decodeURIComponent(req.url);
    var type = mime.lookup(url);
    runHandlerForType(type,req,res,type);
}
var server = http.createServer(function(req, res) {
    console.log((new Date()).toString()+": Request for URL: "+decodeURIComponent(req.url));
    path.exists(path.join(options.basePath,decodeURIComponent(req.url)),
        function(exists){
            if(exists){
                evalRequest(req,res);
            }else{
                lib.serveErrorPage(404,req,res);
            }
        }
    );
});
server.listen(options.port,options.host);