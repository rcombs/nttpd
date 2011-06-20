#!/usr/bin/env node
const VERSION = "0.0.5";
var fs = require("fs"),
    http = require("http"),
    url = require('url'),
    path = require("path"),
    mime = require("mime"),
    vm = require("vm"),
    os = require("os"),
    spawn = require("child_process").spawn;
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
            default: false,
            help: "Configuration file for the server. (Default: none)"
        }
    }).parseArgs();
var config = {};
var requiredFiles = {};
if(options.configFile){
    config = JSON.parse(fs.readSync(options.configFile));
}
String.prototype.endsWith = function(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
};
mime.define({
    "application/x-node-exec": ["njs"],
    "application/x-node-function": ["njf"],
    "application/x-cgi": ["pl", "cgi"],
    "application/x-php": ["php"]
});
var index = ["index.njs", "index.htm", "index.html"];
var handlers = {
    "text/plain": function(req,res,type,filePath){
        fs.readFile(filePath,
            function(err,data){
                if(!err){
                    res.writeHead(200, {'Content-Type': type});
                    res.end(data);
                }else{
                    lib.servePageForError(err,req,res);
                }
            }    
        );
    },
    "application/javascript":"text/plain",
    "application/x-node-exec": function(req,res,type,filePath){
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
            if(!text){
                text = statusText[code];
            }
            res.writeHead(code,text,{"Location": location});
            global.headersSent = true;
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
            try{
                vm.runInNewContext(data,global,filePath);
                res.end();
            }catch(e){
                lib.servePageForError(e,req,res);
            }
        });
    },
    "application/x-node-function": function(req,res,type,filePath){
        try{
            var func = requiredFiles[filePath] || require(filePath);
            func.run(req,res,type,filePath);
        }catch(e){
            lib.servePageForError(e,req,res);
        }
    },
    "application/x-cgi": function(req,res,type,filePath){
        var envVars = {
            SERVER_SOFTWARE: "nttpd v"+VERSION,
            SERVER_NAME: os.hostname(),
            GATEWAY_INTERFACE: "CGI/1.1",
            SERVER_PROTOCOL: "HTTP/"+req.httpVersion,
            SERVER_PORT: options.port,
            REQUEST_METHOD: req.method,
            PATH_INFO: "", // FIXME: WRITEME
            PATH_TRANSLATED: filePath,
            SCRIPT_NAME: req.pURL.pathname,
            QUERY_STRING: req.pURL.query,
            REMOTE_HOST: "", //  FIXME: WRITEME
            REMOTE_ADDR: "", //  FIXME: WRITEME
            AUTH_TYPE: "", // FIXME: WRITEME
            REMOTE_USER: "", // FIXME: WRITEME
            REMOTE_IDENT: "", // FIXME: WRITEME
            CONTENT_TYPE: "", // FIXME: WRITEME
            CONTENT_LENGTH: req.data.length
        };
        var process = spawn(filePath,[],{cwd: path.dirname(filePath), env: envVars, customFds: [req,res,-1]});
        req.resume();
    }
};
function runHandlerForType(type,req,res,otype,filePath){
    if(!handlers[type]){
        runHandlerForType("text/plain",req,res,otype,filePath);
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
    req.data = "";
    req.on("data",function(chunk){
        this.data += chunk;
    });
    req.pause();
    req.pURL = url.parse(req.url);
    var filePath = path.join(options.basePath,decodeURIComponent(req.pURL.pathname));
    var changedPath = false;
    if(filePath.endsWith("/")){
        for(var i = 0; i < index.length; i++){
            if(path.existsSync(path.join(filePath,index[i]))){
                filePath = path.join(filePath,index[i]);
                changedPath = true;
                break;
            }
        }
    }
    filePath = path.resolve(filePath);
    if(changedPath){
        evalRequest(req,res,filePath);
    }else{
        path.exists(filePath,function(exists){
            if(exists){
                fs.stat(filePath,function(err,stats){
                    if(stats.isDirectory()){
                        lib.serveDirIndex(req,res,req.pURL.pathname,filePath);
                    }else{
                        evalRequest(req,res,filePath);
                    }
                });
            }else{
                var splitPathO = req.pURL.pathname.split("/");
                splitPath = splitPathO.slice(1);
                var listDirFunction = function(err,list){
                    if(!err && list.indexOf(splitPath[splitPath.length-1]) != -1){
                        fs.stat(splitPath.join("/"),function(err,stats){
                            if(stats.isDirectory()){
                                lib.serveErrorPage(404,req,res);
                            }else{
                                evalRequest(req,res,path.join(options.basePath,splitPath.join("/")));
                            }
                        });
                    }else if(!err){
                        var loaded = false;
                        var fileName = splitPath[splitPath.length-1];
                        for(var i = 0; i < list.length; i++){
                            if(list[i].indexOf(fileName) == 0 &&
                            (list[i].lastIndexOf(".") == fileName.length || list[i].indexOf(".") == 0)){
                                evalRequest(req,res,path.join(options.basePath,splitPath.slice(0,-1).join("/")+list[i]));
                                loaded = true;
                            }
                        }
                        if(!loaded){
                            if(splitPath.length > 1){
                                splitPath = splitPath.slice(0,-1);
                                fs.readdir(path.join(options.basePath,splitPath.slice(0,-1).join("/")),listDirFunction);
                            }else{
                                lib.serveErrorPage(404,req,res);
                            }
                        }
                    }else{
                        splitPath = splitPath.slice(0,-1);
                        fs.readdir(path.join(options.basePath,splitPath.slice(0,-1).join("/")),listDirFunction);
                    }
                }
                fs.readdir(path.join(options.basePath,splitPath.slice(0,-1).join("/")),listDirFunction);
            }
        });
    }
});
server.listen(options.port,options.host);