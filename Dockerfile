FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 443
CMD ["node", "-e", "const net=require('net');const s=net.createServer(c=>{const o=net.createConnection({host:'access.tgshost.org',port:15743});c.pipe(o);o.pipe(c);});s.listen(443,()=>console.log('proxy ready'));"]
