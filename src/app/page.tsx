"use client";
import React, { useRef, useEffect, MutableRefObject } from 'react';
import io, { Socket } from 'socket.io-client';

const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};

export default function Home(): JSX.Element {
  let localStream: MediaStream | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let isCaller = false;

  const socketRef: MutableRefObject<Socket | null> = useRef(null);
  const localVideoRef: MutableRefObject<HTMLVideoElement | null> = useRef(null);
  const remoteVideoRef: MutableRefObject<HTMLVideoElement | null> = useRef(null);
  const chatInputRef: MutableRefObject<HTMLInputElement | null> = useRef(null);
  const chatWindowRef: MutableRefObject<HTMLDivElement | null> = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:3000');

    socketRef.current.on('answer', () => {
      createPeerConnection();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          if (!peerConnection?.getSenders().some(sender => sender.track === track)) {
            peerConnection?.addTrack(track, localStream!);
          }
        });
      }
    });

    socketRef.current.on('message', async (message: any) => {
      if (!peerConnection) return;
      if (message.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socketRef.current?.emit('message', { type: 'answer', answer: peerConnection.localDescription });
      } else if (message.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
      } else if (message.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    });

    socketRef.current.on('end', () => {
      endCall();
    });

    socketRef.current.on('screenShare', () => {
      startScreenShare();
    });

    socketRef.current.on('chatMessage', (message: string) => {
      appendChatMessage(`Remote: ${message}`);
    });

    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      socketRef.current?.disconnect();
    };
  }, []);

  async function startVideo(): Promise<void> {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      socketRef.current?.emit('startScreenSharing');
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  async function startScreenShare(): Promise<void> {
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.style.width = '100%';
        localVideoRef.current.style.height = '100%';
      }

      if (peerConnection && localStream) {
        localStream.getTracks().forEach(track => {
          if (!peerConnection!.getSenders().some(sender => sender.track === track)) {
            peerConnection!.addTrack(track, localStream!);
          }
        });
      
        const offer = await peerConnection!.createOffer();
        await peerConnection!.setLocalDescription(offer);
        socketRef.current?.emit('message', { type: 'offer', offer: peerConnection!.localDescription });
      }      

    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  function call(): void {
    isCaller = true;
    socketRef.current?.emit('call');
  }

  function answer(): void {
    isCaller = false;
    createPeerConnection();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        if (!peerConnection?.getSenders().some(sender => sender.track === track)) {
          peerConnection?.addTrack(track, localStream!);
        }
      });
    }
    socketRef.current?.emit('answer');
  }

  function endCall(): void {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    socketRef.current?.emit('end');
  }

  function createPeerConnection(): void {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('message', { type: 'candidate', candidate: event.candidate });
      }
    };

    peerConnection.ontrack = event => {
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    if (isCaller && localStream) {
      localStream.getTracks().forEach(track => {
        if (!peerConnection?.getSenders().some(sender => sender.track === track)) {
          peerConnection?.addTrack(track, localStream!);
        }
      });
      peerConnection.createOffer()
        .then(offer => peerConnection?.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit('message', { type: 'offer', offer: peerConnection?.localDescription });
        });
    }
  }

  function sendMessage(): void {
    const message = chatInputRef.current?.value;
    if (message) {
      socketRef.current?.emit('chatMessage', message);
      appendChatMessage(`You: ${message}`);
      if (chatInputRef.current) {
        chatInputRef.current.value = '';
      }
    }
  }

  function appendChatMessage(message: string): void {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatWindowRef.current?.appendChild(messageElement);
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }

  return (
    <div>
      <h1>WebRTC Screen and Video Sharing</h1>
      <div>
        <button id="startVideo" onClick={startVideo}>Start Video</button>
        <button id="startScreenShare" onClick={startScreenShare}>Start Screen Share</button>
        <button id="call" onClick={call}>Call</button>
        <button id="answer" onClick={answer}>Answer</button>
        <button id="end" onClick={endCall}>End</button>
      </div>
      <div>
        <h2>Local Stream</h2>
        <video id="localVideo" autoPlay playsInline ref={localVideoRef}></video>
      </div>
      <div>
        <h2>Remote Stream</h2>
        <video id="remoteVideo" autoPlay playsInline ref={remoteVideoRef}></video>
      </div>
      <div>
        <h2>Chat</h2>
        <div id="chatWindow" ref={chatWindowRef}></div>
        <input type="text" id="chatInput" placeholder="Type a message..." ref={chatInputRef} />
        <button id="sendMessage" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
