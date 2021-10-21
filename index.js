const { v4: uuidv4 } = require("uuid");

const express = require("express");
const app = express();
const { ExpressPeerServer } = require("peer");
const server = require("http").Server(app);

const io = require("socket.io")(server);

app.set('view engine', 'ejs') 

app.use(express.static('public'));
app.use('/socket.io', express.static('node_modules/socket.io/client-dist'));
   
const peerServer = ExpressPeerServer(server, {
    debug: true,
}); 

app.use('/peerjs', peerServer);

app.get("/", (req, res) => {
    // res.status(200).send("Hello World");
    res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
    res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
    console.log('connect => ' + socket.id); 

    socket.on("join-room", (roomId, userId) => {
        console.log('join-room => ' + socket.id , roomId); 
        socket.join(roomId);
        socket.to(roomId).broadcast.emit("user-connected", userId);
    });

    socket.on('disconnect', (e) => {
        console.log('disconnect => ' + socket.id);
    })
}); 

server.listen(3030);