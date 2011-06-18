#!/usr/bin/env node
var fs = require("fs");
var path = require("path");
var shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var sizeNames = ["","K","M","G","T"];
module.exports = function(req,res,p,fullPath){
    res.writeHead(200,"OK",{"Content-Type": "text/html"});
    res.write("<!DOCTYPE html>");
    res.write("<html>");
    res.write("<head>");
    res.write("<title>Index of "+p+"</title>");
    res.write("</head>");
    res.write("<body>");
    res.write("<h1>Index of "+p+"</h1>");
    res.write('<table><tr><th></th><th><a href="?C=N&O=D">Name</a></th><th><a href="?C=M&O=A">Last modified</a></th><th><a href="?C=S&O=A">Size</a></th><th><a href="?C=D&O=A">Description</a></th></tr><tr><th colspan="5"><hr></th></tr>');
    if(p != "/"){
        res.write('<tr><td valign="top"></td><td><a href="'+path.join(p,"..")+'">Parent Directory</a>       </td><td>&nbsp;</td><td align="right">  - </td><td>&nbsp;</td></tr>');
    }
    fs.readdir(fullPath,function(err,list){
        if(!err){
            if(list.length == 0){
                res.write('<tr><th colspan="5"><hr></th></tr>');
                res.write("</table>");
                res.write("</body>");
                res.end("</html>");
            }else{
                var i = 0;
                var loadNext = function(err,stats){
                    if(!err){
                        var file = list[i];
                        var mtime = new Date(stats.mtime);
                        var mstr = mtime.getDate()+"-"+shortMonthNames[mtime.getMonth()]+"-"+mtime.getFullYear()+" "+mtime.getHours()+":"+mtime.getMinutes();
                        var size = stats.size;
                        var j = 0;
                        if(size){
                            while(size > 1024){
                                size = size / 1024;
                                j++;
                            }
                            if(size < 10){
                                size = size.toFixed(1);
                            }else{
                                size = Math.round(size);
                            }
                            size = size + sizeNames[j];
                        }else{
                            size = "  - ";
                        }
                        res.write('<tr><td valign="top"></td><td><a href="'+file+'">'+file+'</a></td><td align="right">'+mstr+'</td><td align="right">'+size+'</td><td>&nbsp;</td></tr>');
                        if(list[i+1]){
                            i++;
                            fs.stat(path.join(fullPath,list[i]),loadNext);
                        }else{
                            res.write('<tr><th colspan="5"><hr></th></tr>');
                            res.write("</table>");
                            res.write("</body>");
                            res.end("</html>");
                        }
                    }else{
                        res.end("DIE, BUG! DIE!");
                    }
                };
                var file = list[i];
                fs.stat(path.join(fullPath,list[i]),loadNext);
            }
        }else{
            res.end("DIE, BUG! DIE!");
        }
    });
};