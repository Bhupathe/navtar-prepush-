import React, { useState, useEffect, useCallback, useRef } from "react";
import ParticipantGrid from "./ParticipantGrid";
import ControlPanel from "./ControlPanel";
import AgoraRTC from "agora-rtc-sdk-ng";

const ConferencePage = ({ user, room, onLeave }) => {
  const [participants, setParticipants] = useState(new Map());
  const [isVideoOn, setIsVideoOn] = useState(user.isVideoOn);
  const [isAudioOn, setIsAudioOn] = useState(user.isAudioOn);
  const [fullScreen, setFullScreen] = useState(false);

  const clientRef = useRef(null);
  const localTracksRef = useRef({ videoTrack: null, audioTrack: null });
  const containerRef = useRef(null);

  // Initialize Agora and media streams
  useEffect(() => {
    const initAgora = async () => {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Handle remote users joining
      client.on("user-published", async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);

        if (mediaType === "video") {
          const remoteVideoTrack = remoteUser.videoTrack;
          // Add to participants list
          setParticipants((prev) => {
            const updated = new Map(prev);
            updated.set(remoteUser.uid, {
              id: remoteUser.uid,
              name: "Remote Doctor", // We don't have metadata over pure Agora usually, fallback
              stream: new MediaStream([remoteVideoTrack.getMediaStreamTrack()]),
              isVideoOn: true,
              isAudioOn: true,
              isMe: false,
              videoTrack: remoteVideoTrack
            });
            return updated;
          });
        }

        if (mediaType === "audio") {
          remoteUser.audioTrack.play();
        }
      });

      client.on("user-unpublished", (remoteUser) => {
        setParticipants((prev) => {
          const updated = new Map(prev);
          updated.delete(remoteUser.uid);
          return updated;
        });
      });

      try {
        const baseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
        const response = await fetch(`${baseUrl}/api/agora/token?channelName=${room}&uid=0`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const { token, appId: serverAppId } = data;

        await client.join(serverAppId, room, token, null);

        // Try to get local tracks, but don't crash if we are on HTTP or denied permissions
        try {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localTracksRef.current = { audioTrack, videoTrack };
          
          if (!isVideoOn) await videoTrack.setEnabled(false);
          if (!isAudioOn) await audioTrack.setEnabled(false);

          await client.publish([audioTrack, videoTrack]);

          setParticipants(new Map([
            ["local", {
              id: "local",
              name: user.name,
              stream: new MediaStream([videoTrack.getMediaStreamTrack()]),
              isVideoOn: isVideoOn,
              isAudioOn: isAudioOn,
              isMe: true,
              videoTrack: videoTrack
            }]
          ]));
        } catch (mediaErr) {
          console.warn("Could not access camera/mic (likely due to HTTP on mobile). Joining as viewer only.", mediaErr);
          // Set a dummy local participant so the UI doesn't break
          setParticipants(new Map([
            ["local", {
              id: "local",
              name: user.name + " (Viewer)",
              stream: null,
              isVideoOn: false,
              isAudioOn: false,
              isMe: true,
              videoTrack: null
            }]
          ]));
        }

      } catch (error) {
        console.error("Agora Error:", error);
      }
    };

    initAgora();

    // Cleanup
    const forceCleanupLocalHardware = () => {
      if (localTracksRef.current?.audioTrack) {
        localTracksRef.current.audioTrack.stop();
        localTracksRef.current.audioTrack.close();
      }
      if (localTracksRef.current?.videoTrack) {
        localTracksRef.current.videoTrack.stop();
        localTracksRef.current.videoTrack.close();
      }
    };
    
    window.addEventListener('beforeunload', forceCleanupLocalHardware);

    return () => {
      window.removeEventListener('beforeunload', forceCleanupLocalHardware);
      const cleanup = async () => {
        forceCleanupLocalHardware();
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          await clientRef.current.leave();
        }
      };
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, user.name]);

  const toggleVideo = useCallback(async () => {
    const { videoTrack } = localTracksRef.current || {};
    if (videoTrack) {
      await videoTrack.setEnabled(!isVideoOn);
      setIsVideoOn(!isVideoOn);

      setParticipants((prev) => {
        const updated = new Map(prev);
        const me = updated.get("local");
        if (me) {
          me.isVideoOn = !isVideoOn;
          updated.set("local", me);
        }
        return updated;
      });
    }
  }, [isVideoOn]);

  const toggleAudio = useCallback(async () => {
    const { audioTrack } = localTracksRef.current || {};
    if (audioTrack) {
      await audioTrack.setEnabled(!isAudioOn);
      setIsAudioOn(!isAudioOn);

      setParticipants((prev) => {
        const updated = new Map(prev);
        const me = updated.get("local");
        if (me) {
          me.isAudioOn = !isAudioOn;
          updated.set("local", me);
        }
        return updated;
      });
    }
  }, [isAudioOn]);

  const leaveConference = useCallback(() => {
    onLeave();
    
    // Force aggressive hardware shutdown immediately on button click
    if (localTracksRef.current?.audioTrack) {
      localTracksRef.current.audioTrack.stop();
      localTracksRef.current.audioTrack.close();
    }
    if (localTracksRef.current?.videoTrack) {
      localTracksRef.current.videoTrack.stop();
      localTracksRef.current.videoTrack.close();
    }
    if (clientRef.current) {
      clientRef.current.leave();
    }

    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, [onLeave]);

  const toggleFullScreen = () => {
    const el = containerRef.current;

    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
      setFullScreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
      setFullScreen(false);
    }
  };

  return (
    <div ref={containerRef} className="conference-container">
      <div className="conference-header">
        <h1 className="conference-title">Conference Room: {room}</h1>
      </div>

      <div className="conference-main">
        <div className="video-section">
          {/* Note: In Agora, playing tracks is usually done by track.play("element_id")
              ParticipantGrid currently uses standard <video> tags and srcObject.
              We created raw MediaStreams out of Agora tracks in the state so it still works,
              but if ParticipantGrid breaks, we need to map over participants and call .play() */}
          <ParticipantGrid participants={Array.from(participants.values())} />
        </div>
      </div>

      <ControlPanel
        isVideoOn={isVideoOn}
        isAudioOn={isAudioOn}
        showChat={false}
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleAudio}
        onToggleChat={() => {}}
        onLeave={leaveConference}
        participantCount={participants.size}
        fullScreen={fullScreen}
        onToggleFullScreen={toggleFullScreen}
      />
    </div>
  );
};

export default ConferencePage;
