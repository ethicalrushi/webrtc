if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

const drone = new ScaleDrone('b6DBzUwhaA5XaPkS');
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;

let depth = 7;

let connections = []

console.log(roomName)

function onSuccess() {};
function onError(error) {
  console.error(error);
};

let currID;

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });

  room.on('members', members => {
    currID = members.length-1;

    if(!connections[currID]) {
      connections[currID] = new RTCPeerConnection(configuration);
    }

    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    }).then(stream => {

      localVideo.srcObject = stream;

      let videoId = 2;

      for(let i=currID-1; i<=currID+1; i++) {
        if(!connections[i]) {
          console.log("Creating new for "+i);
          connections[i] = new RTCPeerConnection(configuration);
          // statsInterval = window.setInterval(getConnectionStats, 1000);
        
          connections[i].onicecandidate = event => {
            if (event.candidate) {
              console.log("sending ice");
              sendMessage({'candidate': event.candidate}, i);
            }
          };

          //presenter's track
          if(currID==depth) {
            stream.getTracks().forEach(track => connections[i].addTrack(track, stream));
          }

          connections[i].ontrack = event => {
            console.log("video by:"+i);
            const stream = event.streams[0];
            let remoteVideoName = "remoteVideo"+Math.floor(videoId/2);
            videoId++;
            remoteVideo = document.getElementById(remoteVideoName)
            if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
              remoteVideo.srcObject = stream;
            }

            // passing on the recieved stream ahead
            if(currID!=depth) {
              stream.getTracks().forEach(track => connections[currID-1].addTrack(track, stream));
            }

            console.log(currID);
            // if(currID===0) {
            //   startWebRTC(false, currID);
            // }
            if(currID>0){
              console.log(connections[currID-1]);
              console.log("calling "+(currID-1));
              startWebRTC(true, currID-1); //calling previous
            }

          };

        }
      }

      startWebRTC(false, currID+1);
      if(currID==depth) {
        startWebRTC(true, depth-1);
      }
    


    // for(let j=0; j<currID; j++) { 
    //   startWebRTC(true, j);
    // }
    
  });
});

  room.on('member_join', members => {
    //could be utilized with custom signalling server
  });

});

function sendMessage(message, i) {
  let newMessage = {
    peerId: currID,
    destId : i,
    msg: message
  }

  message = newMessage
  console.log(message);

  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer, i) {

  if(!connections[i]) {
    connections[i] = new RTCPeerConnection(configuration);
  }

  if (isOfferer) {
    connections[i].onnegotiationneeded = () => {
      connections[i].createOffer().then(function(description) {
        connections[i].setLocalDescription(description).then(function() {
          sendMessage({'sdp': connections[i].localDescription}, i);
        }).catch(onError);
    });
  }
}

  room.on('data', (message, client) => {
    console.log("recirevdd");
    console.log(message);
    if (client.id === drone.clientId) {
      return;
    }

    if(message.destId!=currID) {
      return;
    }

    let pId = message.peerId;

    if (message.msg.sdp) {
      connections[pId].setRemoteDescription(new RTCSessionDescription(message.msg.sdp), () => {
        if (connections[pId].remoteDescription.type === 'offer') {
          connections[pId].createAnswer().then(function(description) {
            connections[pId].setLocalDescription(description).then(function() {
              sendMessage({'sdp': connections[pId].localDescription}, pId);
            }).catch(onError);
        });
        }
      }, onError);
    } else if (message.msg.candidate) {
      connections[pId].addIceCandidate(
        new RTCIceCandidate(message.msg.candidate), onSuccess, onError
      );
    }
  });
}


function getConnectionStats() {  
  connections[currID-1].getStats(null).then(stats => {
    var statsOutput = "back-edge stats ";
 
    stats.forEach(report => {
      if (report.type === "inbound-rtp" && report.kind === "video") {
        Object.keys(report).forEach(statName => {
          statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
        });
      }
    });
    
    console.log(statsOutput);
  });  

  connections[currID+1].getStats(null).then(stats => {
    var statsOutput = "fwd-edge stats ";
 
    stats.forEach(report => {
      if (report.type === "inbound-rtp" && report.kind === "video") {
        Object.keys(report).forEach(statName => {
          statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
        });
      }
    });
    
    console.log(statsOutput);
  });  
}