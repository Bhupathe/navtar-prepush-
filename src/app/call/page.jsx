"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import mqtt from 'mqtt';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LogOut, Monitor, Settings, Mic, MicOff, Video, VideoOff } from 'lucide-react';

function CallUI() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking');

  const [mqttClient, setMqttClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Ready (Bot Standby)');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });

  // Agora states
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState({});
  const clientRef = useRef(null);
  const localVideoRef = useRef(null);
  const localTracksRef = useRef(null);

  const containerRef = useRef(null);

  // Agora Connection Logic
  useEffect(() => {
    const channelName = bookingId || '5'; // Using booking ID or doctor ID 5 as default for testing
    
    const initAgora = async () => {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteUsers(prev => ({ ...prev, [user.uid]: user }));

        if (mediaType === "video") {
          const remoteVideoTrack = user.videoTrack;
          // Play remote video dynamically
          setTimeout(() => {
             const playerContainer = document.getElementById(`remote-video-${user.uid}`);
             if (playerContainer) remoteVideoTrack.play(playerContainer);
          }, 0);
        }
        if (mediaType === "audio") {
          user.audioTrack.play();
        }
      });

      client.on("user-left", (user) => {
        setRemoteUsers(prev => {
          const newUsers = { ...prev };
          delete newUsers[user.uid];
          return newUsers;
        });
      });

      try {
        // Fetch secure token from our new API route
        const response = await fetch(`/api/agora/token?channelName=${channelName}&uid=0`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        const { token, appId: serverAppId } = data;

        await client.join(serverAppId, channelName, token, null);
        setConnectionStatus(`Connected to Call (${channelName})`);

        // Create and publish local tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = { audio: audioTrack, video: videoTrack };
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await client.publish([audioTrack, videoTrack]);
        
        // Play local video
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

      } catch (error) {
        console.error("Agora Error:", error);
        setConnectionStatus("Call Connection Failed");
      }
    };

    initAgora();

    return () => {
      const cleanup = async () => {
        if (localTracksRef.current && localTracksRef.current.audio) {
          localTracksRef.current.audio.stop();
          localTracksRef.current.audio.close();
        }
        if (localTracksRef.current && localTracksRef.current.video) {
          localTracksRef.current.video.stop();
          localTracksRef.current.video.close();
        }
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          await clientRef.current.leave();
        }
      };
      // We explicitly bypass the dependency array linter here to avoid re-running on tracks change
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Global cleanup to violently kill camera on unmount/reload
  useEffect(() => {
    const handleUnload = () => {
      if (localTracksRef.current?.audio) {
        localTracksRef.current.audio.stop();
        localTracksRef.current.audio.close();
      }
      if (localTracksRef.current?.video) {
        localTracksRef.current.video.stop();
        localTracksRef.current.video.close();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Handle Mute/Unmute Toggles
  useEffect(() => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(micOn);
    }
  }, [micOn, localAudioTrack]);

  useEffect(() => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(cameraOn);
    }
  }, [cameraOn, localVideoTrack]);

  // Handle Auto-Exit when booking time is up
  useEffect(() => {
    if (!bookingId) return;

    let checkInterval;

    const enforceTimeLimit = async () => {
      try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          const data = bookingSnap.data();
          const endDate = new Date(`${data.date}T${data.end_time}`);

          checkInterval = setInterval(() => {
            const now = new Date();
            if (now >= endDate) {
              setConnectionStatus("Time's Up! Disconnecting...");
              setTimeout(() => {
                router.push('/dashboard');
              }, 3000);
              clearInterval(checkInterval);
            }
          }, 10000); // Check every 10 seconds
        }
      } catch (err) {
        console.error("Error fetching booking for auto-exit check", err);
      }
    };

    enforceTimeLimit();

    return () => clearInterval(checkInterval);
  }, [bookingId, router]);

  // MQTT logic bypassed for now as requested
  // useEffect(() => {
  //   const MQTT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_URL || 'wss://broker.hivemq.com:8884/mqtt';
  //   const client = mqtt.connect(MQTT_BROKER_URL);
  //   client.on('connect', () => {
  //     setConnectionStatus('Bot Connected');
  //     setMqttClient(client);
  //   });
  //   client.on('error', (err) => {
  //     console.error('MQTT Connection error: ', err);
  //     setConnectionStatus('Bot Connection Failed');
  //   });
  //   return () => {
  //     if (client) {
  //       client.end();
  //     }
  //   };
  // }, []);

  const sendCommand = (x, y) => {
    // if (mqttClient && mqttClient.connected) {
    //   const command = { x: x.toFixed(2), y: y.toFixed(2), timestamp: Date.now() };
    //   mqttClient.publish('navatar/bot/control', JSON.stringify(command));
    // }
  };

  const handleJoystickMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate relative to center, inverted Y for standard joystick feel
    let x = (e.clientX - rect.left - centerX) / centerX;
    let y = (centerY - (e.clientY - rect.top)) / centerY;
    
    // Clamp to -1 to 1
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    setJoystickPos({ x, y });
    sendCommand(x, y);
  };

  const handleJoystickEnd = () => {
    setJoystickPos({ x: 0, y: 0 });
    sendCommand(0, 0);
  };

  const leaveCall = () => {
    if (mqttClient) mqttClient.end();
    
    // Force aggressive cleanup before navigating
    if (localTracksRef.current?.audio) {
      localTracksRef.current.audio.stop();
      localTracksRef.current.audio.close();
    }
    if (localTracksRef.current?.video) {
      localTracksRef.current.video.stop();
      localTracksRef.current.video.close();
    }
    if (clientRef.current) {
      clientRef.current.leave();
    }
    
    router.push('/dashboard');
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 text-blue-400">
           <Monitor className="h-6 w-6" />
           <span className="font-bold">Navatar Telepresence</span>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-sm bg-slate-800 px-3 py-1 rounded-full">
             {connectionStatus}
           </span>
           <span className="text-sm text-slate-400">
             Session: {bookingId || 'Quick Connect'}
           </span>
        </div>
        <Button variant="destructive" size="sm" onClick={leaveCall}>
           <LogOut className="h-4 w-4 mr-2" /> Leave Session
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden">
          
          {/* Remote Videos (The Bot) */}
          {Object.keys(remoteUsers).length === 0 ? (
            <div className="text-center p-8 bg-slate-900/80 rounded-2xl border border-slate-800 max-w-md z-10">
              <Video className="h-16 w-16 mx-auto mb-4 text-slate-600 animate-pulse" />
              <h2 className="text-xl font-bold mb-2">Waiting for Bot...</h2>
              <p className="text-slate-400 text-sm mb-6">
                The bot has not joined the call yet.
              </p>
            </div>
          ) : (
            Object.values(remoteUsers).map(user => (
               <div key={user.uid} id={`remote-video-${user.uid}`} className="w-full h-full object-cover absolute inset-0" />
            ))
          )}

          {/* Local Video Picture-in-Picture */}
          <div 
             className="absolute bottom-6 right-6 w-48 h-36 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl z-20"
             ref={localVideoRef}
          >
             {!cameraOn && (
               <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                  <VideoOff className="h-8 w-8" />
               </div>
             )}
          </div>

          {/* Control Bar Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-4 bg-slate-900/90 p-4 rounded-full border border-slate-800 backdrop-blur-sm z-20 shadow-xl">
             <Button 
                variant={micOn ? "secondary" : "destructive"} 
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setMicOn(!micOn)}
              >
               {micOn ? <Mic /> : <MicOff />}
             </Button>
             <Button 
                variant={cameraOn ? "secondary" : "destructive"} 
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setCameraOn(!cameraOn)}
              >
               {cameraOn ? <Video /> : <VideoOff />}
             </Button>
          </div>
        </div>

        {/* Right Sidebar - Controls */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col">
           <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
             <Settings className="h-5 w-5" /> Bot Controls
           </h3>

           <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col items-center justify-center">
              <CardContent className="p-0 flex flex-col items-center justify-center h-full w-full">
                <p className="text-slate-400 text-sm mb-8">Virtual Joystick</p>
                
                {/* Custom Joystick Area */}
                <div 
                  ref={containerRef}
                  className="w-48 h-48 rounded-full bg-slate-800 border-4 border-slate-700 relative touch-none cursor-crosshair shadow-inner"
                  onPointerDown={(e) => {
                     e.currentTarget.setPointerCapture(e.pointerId);
                     handleJoystickMove(e);
                  }}
                  onPointerMove={(e) => {
                     if (e.buttons > 0) handleJoystickMove(e);
                  }}
                  onPointerUp={(e) => {
                     e.currentTarget.releasePointerCapture(e.pointerId);
                     handleJoystickEnd();
                  }}
                  onPointerCancel={handleJoystickEnd}
                >
                  {/* The Stick Visual */}
                  <div className="w-16 h-16 rounded-full bg-blue-500 absolute top-1/2 left-1/2 -transform-x-1/2 -transform-y-1/2 shadow-lg transition-transform"
                       style={{ 
                         transform: `translate(calc(-50% + ${joystickPos.x * 60}px), calc(-50% + ${-joystickPos.y * 60}px))` 
                       }}
                  />
                </div>

                <div className="mt-8 text-xs text-slate-500 text-center px-4">
                   Drag inside the circle to move the bot. Relase to stop.
                </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-slate-950 text-white flex items-center justify-center">Loading Camera Interface...</div>}>
      <CallUI />
    </Suspense>
  )
}
