const { v4: uuidv4 } = require("uuid");
const Config = require("./config");

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
   
const cert = fs.readFileSync(Config.jwt.privateKey);   
const publicKeyJwt = fs.readFileSync(Config.jwt.publicKey);  

function isValidToken(token){
    return new Promise((resolve, reject)=>{
        if (token == null) return resolve(false) 
      
        jwt.verify(token, publicKeyJwt ,{ algorithms: [Config.jwt.algorithm] },  (err, payload) => { 
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
    var token = jwt.sign(profile, cert, 
        { expiresIn: '14 days', algorithm: Config.jwt.algorithm });

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
// let searchingUsersOffer = new Map;
 
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
    const token = socket.handshake.auth.token;
    console.log('[auth-user]', username);
    const isValid = await isValidToken(token);
    if(isValid) { 
        users.set(socket.id , username)
        userSockets.set(username , socket.id)
        next();
    }
    else{
        next(new Error("auth failed, no user found"));
    } 
});

io.on("connection", (socket) => {

    socket.on('get-random-user', (data) => {
        let user = users.get(socket.id)
        console.log('get-random-user', user, data);   
 
        if(searchingUsers.size > 0 && !searchingUsers.has(user)){
            let guser = getRandomUser(socket.id);
            console.log('match :' , user, guser);

            // let goffer = searchingUsersOffer.get(guser) 
            let guestSocketId = userSockets.get(guser)

            io.to(guestSocketId).emit('match-user', 
                { name: user , to : socket.id, action : 'call'}) 
            socket.emit('match-user', 
                { name: guser, from : guestSocketId, action : 'receive' })

            // searchingUsersOffer.delete(guser)
            searchingUsers.delete(guser)
        }else{ 
            searchingUsers.add(user)
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
    socket.on('disconnect', (e) => {
        console.log('disconnect => ' + socket.id);
        let user = users.get(socket.id);
        users.delete(socket.id) 
        userSockets.delete(user)
    })
}); 

server.listen(3030);

console.log('started 3030');