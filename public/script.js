

let myVideoStream = null;
const myVideoElement = document.getElementById("my-video");
myVideoElement.muted = true; 
const myStatusElement = document.getElementById("my-status");
const guestVideoElement = document.getElementById("guest-video");

let autoSearch = false;
let peerConnection = null
let guest = null;

function authUser(username){
    return new Promise((resolve, reject)=>{ 
        $.post( "/auth", { username })
            .done(function( data ) {
                resolve(data.result);
        });  
    })
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

(async ()=>{
    const username = 'user_' + Math.floor(Math.random() * 900000 +100000 )
    let user = await authUser(username)
    console.log('user', user);
    $('#my-username').html(username)

    const socket = io("/" ,{ 
        query : { username , token: user.token }
    });
    function setGuest(g){ 
        guest = g;
        $('#guest-username').html(g ? g.name : '') 
    }
    function destroyGuest(){
        setGuest(null)
        
        if(peerConnection){
            peerConnection.close()
            peerConnection = null;
        }
    }
    async function makeCall(toSocketId){
        peerConnection = new RTCPeerConnection();
        peerConnection.oniceconnectionstatechange = function(e) {
            if(peerConnection.iceConnectionState == 'disconnected') {
                console.log('Disconnected');
            }
            console.log('oniceconnectionstatechange' ,e);
        }
        peerConnection.onconnectionstatechange = function(e) {
            console.log('onconnectionstatechange' ,e);
        }
        peerConnection.onicecandidate = function(e) {
            console.log('onicecandidate' ,e); 
            if(e.candidate){
                socket.emit('ice-candidate', { to : guest.socket , candidate : e.candidate })
            }
        }
        peerConnection.ontrack = function({ streams: [stream] }) {
            guestVideoElement.srcObject = stream;  
            console.log('guest stream received', stream);
        };
        myVideoStream.getTracks().forEach(track => { 
            console.log('track added');
            peerConnection.addTrack(track, myVideoStream)
        });
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

        console.log('calling', offer);
        socket.emit("make-call", { 
            offer, 
            to : toSocketId 
        });
    }

    async function answerToCall(data){ 
        peerConnection = new RTCPeerConnection();
        peerConnection.oniceconnectionstatechange = function(e) {
            if(peerConnection.iceConnectionState == 'disconnected') {
                console.log('Disconnected');
            }
            console.log('oniceconnectionstatechange' ,e);
        }
        peerConnection.onconnectionstatechange = function(e) {
            console.log('onconnectionstatechange' ,e);
        }
        peerConnection.onicecandidate = function(e) {
            console.log('onicecandidate' , e.candidate);
            if(e.candidate){
                socket.emit('ice-candidate', { to : guest.socket , candidate : e.candidate })
            }
        }
        peerConnection.ontrack = function({ streams: [stream] }) {
            guestVideoElement.srcObject = stream; 
            console.log('guest stream received', stream);
        };

        myVideoStream.getTracks().forEach(track => { 
            console.log('track added');
            peerConnection.addTrack(track, myVideoStream)
        }); 

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );
        const answer = await peerConnection.createAnswer(); 
        await peerConnection.setLocalDescription(new RTCSessionDescription(answer));   
        
        console.log('answered', answer); 

        socket.emit('call-answer', {
            answer,
            to : data.from
        })

    }

    socket.on('connect',async () => {
        console.log('on connected-to-server'); 
        setStatus('connected-to-server');  
        await setupMyVideo()   

        if(autoSearch){
            socket.emit("get-random-user", {  }); 
        }
    }) 
    
    socket.on('call',async (data) => { 
        console.log('on call', data);  
        
        answerToCall(data)
    }) 
    socket.on('call-answered',async (data) => { 
        console.log('on call-answered', data);  
         
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
        );  
    }) 
    socket.on('ice-candidate',async (data) => { 
        console.log('on ice-candidate', data.candidate.substring(0, 10));  
        if(peerConnection) peerConnection.addIceCandidate(data);
    }) 
    
    socket.on('match-user',async (data) => {
        console.log('on match-user', data); 
  
        if(data.action == 'call'){
            makeCall(data.to)
            setGuest({ socket : data.to , name : data.name}) 
        }else if(data.action == 'receive'){
            setGuest({ socket : data.from , name : data.name}) 
        }
    })   
    socket.on('user-disconnected',async (userSocket) => {
        console.log('on user-disconnected', userSocket); 
  
        
        if(guest && guest.socket == userSocket){ 
            destroyGuest();

            if(autoSearch){
                socket.emit("get-random-user", {  }); 
            }
        }

    })  
    function setStatus(status){
        // myStatus = status;
        myStatusElement.innerHTML = status;
    }  
    
    socket.on('disconnect',async () => {
        console.log('socket disconnect'); 
        setStatus('disconnected')
        
        destroyGuest();
    })  
    // socket.on('reconnect',async (number) => {
    //     console.log('socket reconnect'); 
    //     setStatus('reconnect')
    // })  

    $('#btn-start').click(async ()=>{ 
        autoSearch = true;
        $('#btn-stop').show()
        $('#btn-start').html('Next')   
        
        if(peerConnection){
            peerConnection.close()
            peerConnection = null;
        }
        guest = null;

        socket.emit("get-random-user", {  });
    }) 
    
    $('#btn-stop').click(()=>{
        autoSearch = false;
        $('#btn-stop').hide() 
        $('#btn-start').html('Start') 

        socket.emit("stop-search", {  });
    }) 

})()

