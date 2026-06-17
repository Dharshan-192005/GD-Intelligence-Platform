import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Copy, DoorOpen, Mic, MicOff, MonitorUp, PhoneOff, Send, Video, VideoOff, Users, Plus, LogIn, MessageSquare, ShieldCheck, MoreHorizontal } from 'lucide-react';

const API_URL = 'http://localhost:5000';
const SOCKET_URL = 'http://localhost:5000';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const getAuthHeaders = () => {
  const token = localStorage.getItem('gd_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatTime = (value) => {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function LiveMeeting({ currentUser, defaultTopic }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [meetingDraft, setMeetingDraft] = useState({
    title: 'Placement GD Practice Room',
    topic: defaultTopic || 'AI: A Boon or a Bane for Employment?',
    durationMinutes: 20
  });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [meetingError, setMeetingError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [meetingMode, setMeetingMode] = useState('create');

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const chatEndRef = useRef(null);
  const activeRoomCodeRef = useRef('');

  const activeRoomCode = activeRoom?.code || '';
  const roomUrl = activeRoomCode ? `${window.location.origin}/meeting/${activeRoomCode}` : '';
  const currentName = currentUser?.name || 'Participant';

  const authFetch = (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });

  const loadRooms = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/meetings/rooms`);
      if (!res.ok) throw new Error('Could not load rooms');
      setRooms(await res.json());
    } catch (error) {
      setMeetingError(error.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadRooms, 0);
    return () => {
      clearTimeout(timer);
      leaveLiveRoom(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    activeRoomCodeRef.current = activeRoomCode;
  }, [activeRoomCode]);

  const attachLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      stream = new MediaStream();
      setIsMicOn(false);
      setIsCameraOn(false);
      setMeetingError('Camera or microphone permission was blocked. You can still use room chat and invite members.');
    }
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const stopLocalStream = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('meeting:participants', setParticipants);

    socket.on('meeting:chat', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('meeting:participant-joined', async (participant) => {
      const code = activeRoomCodeRef.current;
      if (!code || participant.socketId === socket.id) return;
      const peer = await createPeerConnection(participant.socketId, true);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('meeting:signal', {
        roomCode: code,
        targetSocketId: participant.socketId,
        signal: { type: 'offer', description: offer }
      });
    });

    socket.on('meeting:participant-left', ({ socketId }) => {
      peerConnectionsRef.current[socketId]?.close();
      delete peerConnectionsRef.current[socketId];
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on('meeting:signal', async ({ fromSocketId, signal }) => {
      const code = activeRoomCodeRef.current;
      if (!code || !signal) return;
      const peer = await createPeerConnection(fromSocketId, false);

      if (signal.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('meeting:signal', {
          roomCode: code,
          targetSocketId: fromSocketId,
          signal: { type: 'answer', description: answer }
        });
      }

      if (signal.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
      }

      if (signal.type === 'ice' && signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });

    return socket;
  };

  const createPeerConnection = async (targetSocketId) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const stream = await attachLocalStream();
    const socket = ensureSocket();
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      const code = activeRoomCodeRef.current;
      if (!event.candidate || !code) return;
      socket.emit('meeting:signal', {
        roomCode: code,
        targetSocketId,
        signal: { type: 'ice', candidate: event.candidate }
      });
    };

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => ({ ...prev, [targetSocketId]: remoteStream }));
    };

    peerConnectionsRef.current[targetSocketId] = peer;
    return peer;
  };

  const enterRoom = async (room) => {
    setMeetingError('');
    setIsJoining(true);
    try {
      const joined = await authFetch(`${API_URL}/api/meetings/rooms/${room.code}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: currentName })
      });
      if (!joined.ok) throw new Error('Could not join meeting');
      const roomData = await joined.json();

      const detail = await authFetch(`${API_URL}/api/meetings/rooms/${roomData.code}`);
      if (!detail.ok) throw new Error('Could not load meeting details');
      const data = await detail.json();

      setActiveRoom(data.room);
      activeRoomCodeRef.current = data.room.code;
      setMessages(data.messages || []);
      await attachLocalStream();
      ensureSocket().emit('meeting:join', {
        roomCode: data.room.code,
        user: {
          name: currentName,
          email: currentUser?.email,
          profilePhoto: currentUser?.profilePhoto,
          micOn: isMicOn,
          cameraOn: isCameraOn
        }
      });
    } catch (error) {
      setMeetingError(error.message || 'Meeting could not start.');
    } finally {
      setIsJoining(false);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    setMeetingError('');
    try {
      const res = await authFetch(`${API_URL}/api/meetings/rooms`, {
        method: 'POST',
        body: JSON.stringify({ ...meetingDraft, hostName: currentName })
      });
      if (!res.ok) throw new Error('Could not create meeting room');
      const room = await res.json();
      setRooms(prev => [room, ...prev.filter(item => item.code !== room.code)]);
      await enterRoom(room);
    } catch (error) {
      setMeetingError(error.message);
    }
  };

  const joinRoomByCode = async (e) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    await enterRoom({ code });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !activeRoomCode) return;

    const optimistic = {
      _id: `${Date.now()}`,
      roomCode: activeRoomCode,
      authorName: currentName,
      text,
      type: 'chat',
      createdAt: new Date().toISOString()
    };

    setChatInput('');
    setMessages(prev => [...prev, optimistic]);
    socketRef.current?.emit('meeting:chat', { roomCode: activeRoomCode, message: optimistic });

    try {
      const res = await authFetch(`${API_URL}/api/meetings/rooms/${activeRoomCode}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, authorName: currentName })
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(item => item._id === optimistic._id ? saved : item));
      }
    } catch {
      // The live message is still visible; persistence can recover on next send.
    }
  };

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = next;
    });
    socketRef.current?.emit('meeting:media-state', { roomCode: activeRoomCode, micOn: next, cameraOn: isCameraOn });
  };

  const toggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = next;
    });
    socketRef.current?.emit('meeting:media-state', { roomCode: activeRoomCode, micOn: isMicOn, cameraOn: next });
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.values(peerConnectionsRef.current).forEach(peer => {
        const sender = peer.getSenders().find(item => item.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(peer => {
          const sender = peer.getSenders().find(item => item.track?.kind === 'video');
          if (cameraTrack) sender?.replaceTrack(cameraTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      };
    } catch {
      setMeetingError('Screen sharing was cancelled or blocked.');
    }
  };

  async function leaveLiveRoom(shouldEnd = false) {
    if (shouldEnd && activeRoomCode) {
      try {
        await authFetch(`${API_URL}/api/meetings/rooms/${activeRoomCode}/end`, { method: 'POST' });
      } catch {
        // Leaving locally still matters even if the host-end request fails.
      }
    }

    socketRef.current?.emit('meeting:leave', { roomCode: activeRoomCode });
    socketRef.current?.disconnect();
    socketRef.current = null;
    Object.values(peerConnectionsRef.current).forEach(peer => peer.close());
    peerConnectionsRef.current = {};
    stopLocalStream();
    setActiveRoom(null);
    setParticipants([]);
    setRemoteStreams({});
    loadRooms();
  }

  const remoteTiles = useMemo(() => Object.entries(remoteStreams), [remoteStreams]);

  return (
    <section className="meeting-workspace">
      <div className="meeting-hero">
        <div>
          <span><Video size={18} /> Real GD Meeting</span>
          <h1>Host a live group discussion room</h1>
          <p>Create a Zoom-like GD space with camera, mic, room code, chat, screen sharing, and saved meeting history.</p>
        </div>
        {activeRoom ? (
          <button type="button" className="btn-danger" onClick={() => leaveLiveRoom(true)}>
            <PhoneOff size={17} /> End Meeting
          </button>
        ) : (
          <div className="meeting-hero-code">
            <small>Meeting stack</small>
            <strong>WebRTC + Socket.IO + MongoDB</strong>
          </div>
        )}
      </div>

      {meetingError && <div className="setup-error">{meetingError}</div>}

      {!activeRoom ? (
        <div className="meeting-lobby-grid">
          <div className="meeting-preview-console">
            <div className="meeting-preview-top">
              <span>Live room preview</span>
              <small>{meetingDraft.durationMinutes} min room</small>
            </div>
            <div className="meeting-preview-grid">
              <div className="meeting-preview-tile is-large"><Users size={38} /><span>Host</span></div>
              <div className="meeting-preview-tile is-large"><Users size={38} /><span>Speaker 2</span></div>
              <div className="meeting-preview-tile"><Users size={25} /><span>Speaker 3</span></div>
              <div className="meeting-preview-tile"><Users size={25} /><span>Speaker 4</span></div>
              <div className="meeting-preview-tile"><Users size={25} /><span>Observer</span></div>
            </div>
            <div className="meeting-preview-dock">
              <span><Mic size={15} /> Mic</span>
              <span><Video size={15} /> Camera</span>
              <span><MessageSquare size={15} /> Chat</span>
            </div>
          </div>

          <div className="meeting-action-column">
            <div className="meeting-mode-switch" role="tablist" aria-label="Meeting action">
              <button
                type="button"
                className={meetingMode === 'create' ? 'is-active' : ''}
                onClick={() => setMeetingMode('create')}
              >
                <Plus size={17} />
                Create Meeting
              </button>
              <button
                type="button"
                className={meetingMode === 'join' ? 'is-active' : ''}
                onClick={() => setMeetingMode('join')}
              >
                <LogIn size={17} />
                Join Meeting
              </button>
            </div>

            {meetingMode === 'create' ? (
              <form className="meeting-create-card" onSubmit={createRoom}>
                <div className="meeting-card-title">
                  <Plus size={20} />
                  <div>
                    <h2>Create Meeting</h2>
                    <p>Set the topic and open a room for your GD group.</p>
                  </div>
                </div>
                <label>
                  Meeting Name
                  <input value={meetingDraft.title} onChange={(e) => setMeetingDraft(prev => ({ ...prev, title: e.target.value }))} />
                </label>
                <label>
                  GD Topic
                  <textarea value={meetingDraft.topic} onChange={(e) => setMeetingDraft(prev => ({ ...prev, topic: e.target.value }))} />
                </label>
                <label>
                  Duration
                  <select value={meetingDraft.durationMinutes} onChange={(e) => setMeetingDraft(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary" disabled={isJoining}>
                  <Video size={17} /> {isJoining ? 'Starting...' : 'Create Live Room'}
                </button>
              </form>
            ) : (
              <form className="meeting-join-card" onSubmit={joinRoomByCode}>
              <div className="meeting-card-title">
                <LogIn size={20} />
                <div>
                  <h2>Join With Code</h2>
                  <p>Enter the room code shared by the host to join instantly.</p>
                </div>
              </div>
              <input value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="Example: GD-A1B2C3" />
              <button type="submit" className="btn-secondary" disabled={isJoining || !roomCodeInput.trim()}>
                <DoorOpen size={17} /> Join Room
              </button>
            </form>
            )}

            <div className="meeting-recent-card">
              <h2>Recent Rooms</h2>
              {rooms.length === 0 ? (
                <p>No meeting rooms yet. Create one and invite your group.</p>
              ) : rooms.map(room => (
                <button key={room._id || room.code} type="button" onClick={() => enterRoom(room)}>
                  <span>{room.code}</span>
                  <strong>{room.title}</strong>
                  <small>{room.topic}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="meeting-console">
          <div className="meeting-console-topbar">
            <div>
              <strong>{activeRoom.title}</strong>
              <span>{activeRoom.code} · {activeRoom.durationMinutes} minute GD</span>
            </div>
            <div className="meeting-console-actions">
              <button type="button" onClick={() => navigator.clipboard?.writeText(roomUrl || activeRoom.code)}>
                <Copy size={15} /> Invite
              </button>
              <button type="button">
                <ShieldCheck size={15} /> Host Controls
              </button>
            </div>
          </div>

          <div className="meeting-room-grid">
            <div className="meeting-stage">
            <div className="meeting-stage-head">
              <div>
                <span>{activeRoom.code}</span>
                <h2>{activeRoom.topic}</h2>
                <p>{activeRoom.title} · {activeRoom.durationMinutes} minute GD room</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(roomUrl || activeRoom.code)}>
                <Copy size={16} /> Copy Invite
              </button>
            </div>

            <div className="meeting-video-grid">
              <div className="meeting-video-tile is-local">
                <video ref={localVideoRef} autoPlay playsInline muted />
                <div>
                  <strong>{currentName} (You)</strong>
                  <span>{isMicOn ? 'Mic on' : 'Muted'} · {isCameraOn ? 'Camera on' : 'Camera off'}</span>
                </div>
              </div>
              {remoteTiles.map(([socketId, stream]) => {
                const participant = participants.find(item => item.socketId === socketId);
                return (
                  <RemoteVideoTile key={socketId} stream={stream} participant={participant} />
                );
              })}
              {remoteTiles.length === 0 && (
                <div className="meeting-empty-tile">
                  <Users size={32} />
                  <strong>Waiting for members</strong>
                  <p>Share code {activeRoom.code}. New members appear here when they join.</p>
                </div>
              )}
            </div>

            </div>

            <aside className="meeting-panel">
            <div className="meeting-panel-section">
              <h3>Participants</h3>
              <div className="meeting-participant-list">
                {participants.map(participant => (
                  <div key={participant.socketId}>
                    <span>{participant.profilePhoto ? <img src={participant.profilePhoto} alt="" /> : participant.name?.charAt(0) || 'P'}</span>
                    <div>
                      <strong>{participant.name}</strong>
                      <small>{participant.micOn ? 'Mic on' : 'Muted'} · {participant.cameraOn ? 'Camera on' : 'Camera off'}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="meeting-panel-section meeting-chat-section">
              <h3>Meeting Chat</h3>
              <div className="meeting-chat-feed">
                {messages.map(message => (
                  <div key={message._id || `${message.createdAt}-${message.text}`} className={message.type === 'system' ? 'is-system' : ''}>
                    <strong>{message.authorName}</strong>
                    <p>{message.text}</p>
                    <small>{formatTime(message.createdAt)}</small>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form className="meeting-chat-input" onSubmit={sendMessage}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message the room..." />
                <button type="submit" disabled={!chatInput.trim()}><Send size={16} /></button>
              </form>
            </div>
            </aside>
          </div>

          <div className="meeting-control-bar">
            <button type="button" onClick={toggleMic} className={!isMicOn ? 'is-danger' : ''} title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}>
              {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{isMicOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button type="button" onClick={toggleCamera} className={!isCameraOn ? 'is-danger' : ''} title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}>
              {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              <span>{isCameraOn ? 'Camera' : 'Camera Off'}</span>
            </button>
            <button type="button" onClick={shareScreen} title="Share screen">
              <MonitorUp size={18} />
              <span>Share</span>
            </button>
            <button type="button" title="More meeting options">
              <MoreHorizontal size={18} />
              <span>More</span>
            </button>
            <button type="button" className="is-danger is-leave" onClick={() => leaveLiveRoom(false)} title="Leave meeting">
              <PhoneOff size={18} />
              <span>Leave</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RemoteVideoTile({ stream, participant }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="meeting-video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <div>
        <strong>{participant?.name || 'Participant'}</strong>
        <span>{participant?.micOn ? 'Mic on' : 'Muted'} · {participant?.cameraOn ? 'Camera on' : 'Camera off'}</span>
      </div>
    </div>
  );
}
