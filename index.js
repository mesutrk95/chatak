const { v4: uuidv4 } = require("uuid"); 

const { JWT_SECRET, PORT } = process.env; 
const fs = require("fs");
const express = require("express"); 
const jwt = require('jsonwebtoken'); 
const app = express(); 
const server = require("http").Server(app);

const io = require("socket.io")(server);

app.set('view engine', 'ejs') 
app.use(express.urlencoded());

app.use(express.static('public'));
app.use('/socket.io', express.static('node_modules/socket.io/client-dist'));

function isValidToken(token){
    return new Promise((resolve, reject)=>{
        if (token == null) return resolve(false) 
      
        jwt.verify(token, JWT_SECRET, (err, payload) => { 
          if (err) return resolve(false)
          return resolve(true);
        })
    })
}

app.get("/", (req, res) => { 
    res.render("index", {}); 
});
  
app.post("/auth", (req, res) => { 
    var profile= {
        username : req.body.username
    }
    var token = jwt.sign(profile, JWT_SECRET, 
        { expiresIn: '14 days' });

    res.json({
        status: 'ok', 
        result : {
            token,
            username: profile.username
        }
    })
});
  
let users = new Map
let userSockets = new Map
let searchingUsers = new Set;
let connections = new Map();

app.get("/manage", (req, res) => { 
    let usersList = Array.from(users, ([socketId, username]) => ({ socketId, username }));
    let connsList = Array.from(connections, ([u1, u2]) => ({ u1, u2 }));
    let searchingUsersList = Array.from(searchingUsers, username =>{ return { username, socketId : userSockets.get(username) }});

    res.render("manage", {users : usersList, conns : connsList, searchingUsers : searchingUsersList}); 
});
  

function logConnections(){ 
} 

function addConnection(u1, u2){
    connections.set(u1, u2)
    connections.set(u2, u1)
}
function getConnection(u){
    let conn = connections.get(u) 
    return conn ? { guestUser : conn } : null 
}
function removeConnection(u1){
    let u2 = connections.get(u1) 
    connections.delete(u1);
    connections.delete(u2); 
}

function getRandomUser(exceptUser){ 
    let sus = Array.from(searchingUsers);
    let randomUser ;
    do{
        let randomIndex = Math.floor(Math.random() * searchingUsers.size);
        randomUser = sus[randomIndex]
    } while(randomUser == exceptUser) 

    return randomUser
}


io.use(async (socket, next) => { 
    
    const username = socket.handshake.query.username;
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    console.log('[auth-user]', username);
    const isValid = await isValidToken(token);
    if(isValid) { 
        users.set(socket.id , username)
        userSockets.set(username , socket.id)
        socket.user = { username }
        next();
    }
    else{
        next(new Error("auth failed, no user found"));
    } 
});

io.on("connection", (socket) => {

    socket.on('get-random-user', (data) => {
        let username = socket.user.username
        console.log('get-random-user', username, data);   

        let conn = getConnection(username);
        if(conn){
            removeConnection(username)
            let socketId = userSockets.get(conn.guestUser)
            io.to(socketId).emit('user-disconnected', socket.id)
        }
 
        if(searchingUsers.size > 0 && !searchingUsers.has(username)){
            let guser = getRandomUser(socket.id);
            console.log('match :' , username, guser);

            // let goffer = searchingUsersOffer.get(guser) 
            let guestSocketId = userSockets.get(guser)

            addConnection(username, guser);

            io.to(guestSocketId).emit('match-user', 
                { name: username , to : socket.id, action : 'call'}) 
            socket.emit('match-user', 
                { name: guser, from : guestSocketId, action : 'receive' })

            // searchingUsersOffer.delete(guser)
            searchingUsers.delete(guser)
        }else{ 
            searchingUsers.add(username)
            // searchingUsersOffer.set(user , data.offer)
        }
    }) 
 
    socket.on('make-call', (data) => { 
        // let calleeUser = users.get(data.socketId)
        io.to(data.to).emit('call', { 
            offer : data.offer, from : socket.id
        }) 
    })

    socket.on('call-answer', (data) => { 
        io.to(data.to).emit('call-answered', { 
            answer : data.answer
        })  
    })
    socket.on("ice-candidate", data => {
      socket.to(data.to).emit("ice-candidate", data.candidate);
    }); 

    const disconnect =(e) => {
        console.log(e + ' => ' + socket.id); 
        let username = socket.user.username

        let conn = getConnection(username);
        if(conn){
            removeConnection(username)
            let socketId = userSockets.get(conn.guestUser)
            io.to(socketId).emit('user-disconnected', socket.id)
        }
        users.delete(socket.id) 
        userSockets.delete(username)
        searchingUsers.delete(username);
    }

    socket.on('stop-search', (e) => {
        console.log('stop-search => ' + socket.id);
        let username = socket.user.username
        let conn = getConnection(username);
        if(conn){
            removeConnection(username)
            let socketId = userSockets.get(conn.guestUser)
            io.to(socketId).emit('user-disconnected', socket.id)
        } 
        searchingUsers.delete(username);
    })

    socket.on('disconnect', (e) => disconnect('disconnect', e))
}); 

server.listen(PORT);

console.log('chatak server running on : ' + PORT);