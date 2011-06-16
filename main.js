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
String.prototype.endsWith = function(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
};
mime.define({"application/node": ["njs"]});
var index = ["index.njs", "index.htm", "index.html"];
var handlers = {
    "text/plain": function(req,res,type,filePath){
        fs.readFile(path,
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
    "application/node": function(req,res,type,filePath){
        var statusText = lib.statusText;
        var global = {
            headers: {"Content-Type": "text/plain"},
            require: require,
            status: {code: 200, text: "OK"},
            req: req,
            res: res
        };
        global.setStatus = function(code,text){
            global.status.code = code;
            if(text){
                global.status.text = text;
            }else{
                global.status.text = statusText[code];
            }
        };
        global.redirect = function(location,code,text){
            if(!code){
                code = 301;
            }
            global.setStatus(code,text);
            global.headers.Location = location;
        };
        global.echo = function(text){
            if(!global.headersSent){
                res.writeHead(global.status.code,global.status.text,global.headers);
                global.headersSent = true;
            }
            res.write(text);
        };
        global.setHeader = function(name,value){
            global.headers[name] = value;
        };
        global.setType = function(type){
            global.headers["Content-Type"] = type;
        }
        global.global = global;
        fs.readFile(filePath,"utf-8",function(err,data){
            vm.runInNewContext(data,global,filePath);
            res.end();
        });
    }
};
function runHandlerForType(type,req,res,otype,filePath){
    if(!handlers[type]){
        runHandlerForType("text/plain",req,res,"text/plain",filePath);
    }else if(typeof handlers[type] == "string"){
        runHandlerForType(handlers[type],req,res,otype,filePath);
    }else{
        handlers[type](req,res,otype,filePath);
    }
}
function evalRequest(req,res,filePath){
    var type = mime.lookup(filePath);
    runHandlerForType(type,req,res,type,filePath);
}
var server = http.createServer(function(req, res) {
    console.log((new Date()).toString()+": Request for URL: "+decodeURIComponent(req.url));
    var filePath = path.join(options.basePath,decodeURIComponent(req.url));
    var changedPath = false;
    if(filePath.endsWith("/")){
        for(var i = 0; i < index.length; i++){
            if(path.existsSync(path.join(filePath,index[i]))){
                filePath = path.join(filePath,index[i]);
                changedPath = true;
                break;
            }
        }
        if(!changedPath){
            lib.serveErrorPage(404,req,res);
            return;
        }
    }
    if(changedPath || path.existsSync(filePath)){
        evalRequest(req,res,filePath);
    }else{
        lib.serveErrorPage(404,req,res);
    }
});
server.listen(options.port,options.host);