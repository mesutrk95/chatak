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
    res.render("index", {}); 
});

// app.get("/:room", (req, res) => {
//     res.render("index", { roomId: req.params.room });
// });

let users = new Map();
let searchingUsers = new Set();

io.on("connection", (socket) => {

    socket.on("join", (userId) => { 
        console.log('joined => sid : ' + socket.id + ', uid = ' + userId); 

        const user = { socket, userId };
        users.set(socket.id, user)

        /* debug log only */
        console.log('active users : ' + users.size);  
    }); 

    // socket.on("toggle-user-search", ()=>{
    //     let user = users.get(socket.id)
    //     if(!user){
    //         searchingUsers.set(user)
    //         socket.emit('user-search-status' , true)  
    //     }else{ 
    //         searchingUsers.delete(user)
    //         socket.emit('user-search-status' , false)
    //     }
    // }) 

    socket.on("get-random-user", () => {
        
        if(searchingUsers.size == 0){ 
            searchingUsers.add(socket.id)
        } else {
            if(searchingUsers.size == 1 && searchingUsers.has(socket.id)){ 

            }else{
                let sus = Array.from(searchingUsers);
                let guestId ;
                do{
                    let randomIndex = Math.floor(Math.random() * sus.length);
                    guestId = sus[randomIndex]
                }while(guestId == socket.id) 

                searchingUsers.delete(guestId)
                const fromUser = users.get(socket.id)
                const toUser = users.get(guestId)
                console.log('suggest : ' , guestId, socket.id);
                socket.emit("random-user", { action : 'call', userId : toUser.userId});
                io.to(guestId).emit("random-user", { action : 'receive',  userId : fromUser.userId});
            }
        } 
    }); 

    socket.on('disconnect', (e) => {
        console.log('disconnect => ' + socket.id);
        users.delete(socket.id)
        searchingUsers.delete(socket.id)
    })
}); 

server.listen(3030);

console.log('started');