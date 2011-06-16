#!/usr/bin/env node
module.exports = function(error,req,res){
    res.writeHead(500,"Internal Server Error",{"Content-Type": "text/html"});
    res.write("<!DOCTYPE html>");
    res.write("<html>");
    res.write("<head>");
    res.write("<title>Internal Server Error</title>");
    res.write("</head>");
    res.write("<body>")
    res.write("<h1>Internal Server Error</h1>");
    res.write("<p>Message: "+error.message+"</p>");
    res.write("<p>Stack:</p>");
    res.write("<pre>"+error.stack+"</pre>")
    res.write("</body>");
    res.end("</html>");
};