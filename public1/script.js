

const socket = io("/");
let peer = null;

let myStatus = 'connecting';
let autoSearch =  false;

let myVideoStream = null;
const myVideoElement = document.getElementById("my-video");
const myStatusElement = document.getElementById("my-status");
const guestVideoElement = document.getElementById("guest-video");

let currentGuestConnection;

myVideoElement.muted = true; 
 
function setStatus(status){
    // myStatus = status;
    myStatusElement.innerHTML = status;
}

function getUserMediaSync (options){
    return new Promise((resolve, reject)=>{
        var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia; 
        getUserMedia(options || { audio: true, video: true }, 
            stream => { 
                resolve(stream);
        }, err=>{
            reject(err)
        })  
    }) 
}
  
async function setupMyVideo(){
    try{
        myVideoStream = await getUserMediaSync();  
        myVideoElement.srcObject = myVideoStream;
        myVideoElement.addEventListener("loadedmetadata", () => {
            myVideoElement.play(); 
        });
    }catch(ex){
        console.error(ex);
    }
}

function setupPeerJs(){
    if(peer && peer.open) {
        socket.emit('join', userId)
        return;
    }

    peer = new Peer(undefined, {
        path: "/peerjs",
        host: "/",
        port: "3030",
    }); 
    
    peer.on("open", async (userId) => { 
        console.log('peerjs user :' , userId);
        socket.emit('join', userId) 
    })

    peer.on("call", (guestConnection) => {
        console.log('call from : ' , guestConnection);
        currentGuestConnection = guestConnection
        currentGuestConnection.answer(myVideoStream);
        currentGuestConnection.on("stream", (guestVideoStream) => {
            // console.log('stream from : ' ,userVideoStream ); 
            guestVideoElement.srcObject = guestVideoStream;
            guestVideoElement.addEventListener("loadedmetadata", () => {
                guestVideoElement.play(); 
            }); 
        });

        currentGuestConnection.on('close' , ()=>{
            console.log('guest peer closed');
            if(autoSearch){
                socket.emit('get-random-user')
            }
        })
    });

    peer.on('error', (err) => {
        console.log('guest peer error', err);
    });
    peer.on('disconnected', (err) => {
        console.log('peer disconnected', err);
    });
}

function joined(){
    myStatus = 'ready';
}

function callToUser(userId){ 
    const call = peer.call(userId, myVideoStream); 
    console.log('call obj', call);
    currentGuestConnection = call;
    call.on("stream", guestVideoStream => {
        console.log('stream-from : ' ,userId , guestVideoStream);  

        guestVideoElement.srcObject = guestVideoStream;
        guestVideoElement.addEventListener("loadedmetadata", () => {
            guestVideoElement.play(); 
        }); 
    });
    call.on('close' , ()=>{
        console.log('guest peer closed');
        if(autoSearch){
            socket.emit('get-random-user')
        }
    }) 
    call.on('error' , (error)=>{
        console.log('guest peer error' ,error); 
    }) 
}

socket.on('connect',async () => {
    console.log('on connected-to-server');
    setStatus('connected-to-server');
    await setupMyVideo()
    await setupPeerJs() 
}) 
socket.on('joined',async () => { 
    console.log('on joined'); 
    setStatus('joined'); 
    await joined();
}) 

socket.on('random-user',async (data) => {
    console.log('on random-user', data); 
    // searching = false;
    if(data.action == 'call'){
        callToUser(data.userId);
    }else if(data.action == 'receive'){ 

    }
})  
 
socket.on('conn-destroy',async (userId) => {
    if(currentGuestConnection && currentGuestConnection.peer == userId){
        console.log('guest peer closed');
        if(autoSearch){
            socket.emit('get-random-user')
        }
    }
})  
 
socket.on('disconnect',async () => {
    console.log('socket disconnect'); 
}) 

function disconnectFromUser(){
    if(currentGuestConnection){
        console.log('destroy media conn' , currentGuestConnection);
        socket.emit('conn-destroy', currentGuestConnection.peer)
        currentGuestConnection.close()
        currentGuestConnection =null;
    }
}

function startAutoSearch(){  
    // searching = true;
    if(autoSearch){ 
        disconnectFromUser();
    }else{ 
        $('#btn-stop').show()
        $('#btn-start').html('Next')
    
        disconnectFromUser();
        socket.emit('get-random-user')
    }
    autoSearch = true;
}
  
function stopAutoSearch(){ 
    autoSearch = false;
    $('#btn-stop').hide() 
    $('#btn-start').html('Start')
    
    disconnectFromUser();
}
   