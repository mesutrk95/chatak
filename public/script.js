

let myVideoStream = null;
const myVideoElement = document.getElementById("my-video");
myVideoElement.muted = true; 
const myStatusElement = document.getElementById("my-status");
const guestVideoElement = document.getElementById("guest-video");

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
        auth: { token :  user.token },
        query : { username }
    });

    
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
        // peerConnection.addTrack(myVideoStream.getTracks()[0], myVideoStream)
        // peerConnection.addTransceiver("video"); 

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );
        const answer = await peerConnection.createAnswer();
        // setTimeout(async () => { 
            await peerConnection.setLocalDescription(new RTCSessionDescription(answer));  
        // }, 3000);
        
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
        console.log('on ice-candidate', data);  
        peerConnection.addIceCandidate(data);
    }) 
    
    socket.on('match-user',async (data) => {
        console.log('on match-user', data); 
 
        $('#guest-username').html(data.name) 

        if(data.action == 'call'){
            makeCall(data.to)
            guest = { socket : data.to}
        }else if(data.action == 'receive'){
            guest = { socket : data.from }
        }
    })   
     
    
    socket.on('disconnect',async () => {
        console.log('socket disconnect'); 
    })  
    function setStatus(status){
        // myStatus = status;
        myStatusElement.innerHTML = status;
    }

    $('#btn-start').click(async ()=>{ 
        autoSearch = true;
        $('#btn-stop').show()
        $('#btn-start').html('Next')   
        
        if(peerConnection){
            peerConnection.close()
            peerConnection = null;
        }
        socket.emit("get-random-user", {  });
    }) 
    
    $('#btn-stop').click(()=>{
        autoSearch = false;
        $('#btn-stop').hide() 
        $('#btn-start').html('Start') 
    }) 

})()

