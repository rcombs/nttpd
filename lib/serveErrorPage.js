#!/usr/bin/env node
module.exports = function(code,req,res){
    res.writeHead(code, {'Content-Type': "text/plain"});
    res.end("ERROR #"+code);
};