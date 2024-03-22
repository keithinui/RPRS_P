
﻿const Peer = window.Peer;
var room;
var peer;
var youJoyned = 0;
let timerStats;
let msg = "";

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once('open', () => {
      msg = '=== You joined ===\n';
      messages.textContent = msg;
      joinTrigger.style = "background:#00F00F";
      youJoyned = 1;
      console.log("Mode: " + roomMode.textContent);
      
    });
    room.on('peerJoin', peerId => {
      msg += `=== ${peerId} joined ===\n`;
      messages.textContent = msg;
    });

    let bytesReceivedPrevious = 0;     // Previous sample data of bytesReceived
    let bytesSentPrevious = 0;         // Previous sample data of bytesSent 

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);

      // Get data volume by using getStats API
      timerStats = setInterval(async () => {
        // Get peer connection followed by room mode
        if(roomMode.textContent == "mesh"){
          const pcs = room.getPeerConnections();
          for ( [peerId, pc] of Object.entries(pcs) ) {
            getRTCStats(await pc.getStats());
          }
        } else if(roomMode.textContext == "sfu"){
          const pc = room.getPeerConnection();
          getRTCStats(await pc.getStats());
        }
      },1000);
    });

    // Get bytesReceived and bytesSent from stats
    function getRTCStats(stats) {
      let bufR;
      let bufS;
      // stats is [{},{},{},...]
      stats.forEach((report) => {
        // When RTCStatsType of report is 'inbound-rtp' or 'outbound-rtp' Object and kind is 'video'.
        if(report.kind == "video") {
          if(report.type == "inbound-rtp") {
            bufR = (report.bytesReceived - bytesReceivedPrevious)*8/1024/1024;
            bytesReceivedPrevious = report.bytesReceived; // Total recived volume of the stream
          }
          if(report.type == "outbound-rtp") {
            bufS = (report.bytesSent - bytesSentPrevious)*8/1024/1024;
            bytesSentPrevious = report.bytesSent; // Total sent volume of the stream
          }
        }
      });
      messages.textContent = msg + `Received[bps]=${bufR.toFixed(2)}, Sent[bps]=${bufS.toFixed(2)}\n`;
    }
    
    room.on('data', ({ data, src }) => {
      if(applicationMode ==1){
        // Doctor mode *********************************************
        // Show PR and Battery level data sent from the remort
        if (data.length < 20){
          textPR.innerHTML             = data[0];
          statusSpo2.innerHTML         = data[2];
          statusBatteryLavel.innerHTML = data[3];
        }else{
          // Show waveform data
          displayWaveforms(data);
        }

      }else{
        // Patient mode ********************************************
        // if ECG waveforms requested, start timer to send
        // and show CAL button and make its event
        console.log("Data sent in patient mode!: Data = " + data[0]);

        if(data[0]){
          timer1 = setInterval("transmitData()", DataCount);
          sendCal.style.display = "block";
          sendCal.addEventListener('click', onCalSend);
        }else{
          clearInterval(timer1);
          sendCal.style.display = "none";
        }
      }
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id=${peerId}]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      clearInterval(timerStats);    // Stop timer for getStats
      msg += `=== ${peerId} left ===\n`;
      messages.textContent = msg;
    });

    // for closing myself
    room.once('close', () => {
      msg += '== You left ===\n';
      messages.textContent = msg; 
      joinTrigger.style = "background:''";
      youJoyned = 0;
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    if(applicationMode == 1){
      sendTrigger.addEventListener('click', onClickSend);
    }
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      if(sendWaveforms == 1){
        // Clear and close the waveform window
        m_workDC.clearRect(0, 0, ox, oy);  // Clear all canvas
        $(".p2p-media #canvas_wrapper").height(0);
        sendWaveforms = 0;
        sendTrigger.innerText = 'Send ECG Waveforms';
        sendTrigger.style = "background:''; width:250px";
      }else{
        // Open the waveform window
        $(".p2p-media #canvas_wrapper").height(oy);
        sendWaveforms = 1;
        sendTrigger.innerText = 'Stop sending ECG Waveforms';
        sendTrigger.style = "background:#00F00F; width:250px";
        initDisplay = 1;
      }

      // Send sendWaveform request
      let tmpData =[];
      tmpData[0] = sendWaveforms;
      tmpData[1] = 0;  // Reserved
      tmpData[2] = 0;  // Reserved
      tmpData[3] = 0;  // Reserved
      tmpData[4] = 0;  // Reserved
      room.send(tmpData);
    }
  });

  peer.on('error', console.error);
})();
