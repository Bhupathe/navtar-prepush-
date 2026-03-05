import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './VideoScreen.css';
import { useNavigate } from 'react-router-dom';

import Modal from '../common/Modal';

function useMicrophoneLevel() {
  const [level, setLevel] = useState(0);
  const [analyzer, setAnalyzer] = useState(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    setAnalyzer(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setLevel(avg / 255); // Normalize to 0-1
      requestAnimationFrame(checkLevel);
    };
    checkLevel();

    return () => {
      source.disconnect();
      if (audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream]);

  const startMonitoring = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(newStream);
    } catch (err) {
      console.error('Failed to get microphone access:', err);
    }
  };

  const stopMonitoring = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return { level, startMonitoring, stopMonitoring };
}

function MicrophoneLevelBar({ level, isMuted }) {
  return (
    <div className="mic-level-bar-container">
      <div
        className="mic-level-bar"
        style={{
          height: `${isMuted ? 0 : level * 100}%`,
          backgroundColor: isMuted ? '#ccc' : '#4CAF50',
        }}
      />
    </div>
  );
}

function VideoScreen() {
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalFooter, setModalFooter] = useState(null);
  const [modalType, setModalType] = useState('info');

  const { user } = useAuth();
  const navigate = useNavigate();
  const { level, startMonitoring, stopMonitoring } = useMicrophoneLevel();

  const APP_ID = 'a7aeacef31f4472ab9e1545f3622309a';
  const TOKEN = '007eJxTYJCJKOg+sFvfguNUywlDjWBJY/7TXfe3vdmpdqpRTOTr1noFhkTzxNTE5NQ0Y8M0ExNzo8Qky1RDUxPTNGMzIyNjA8tEjWnhGQ2BjAyTLKazMDJAIIgvyFCWmZKa75yfV1yaU5JYkpmfx8AAALHyI6c=';
  const CHANNEL = 'videoConsultation';

  useEffect(() => {
    const initAgora = async () => {
      try {
        await client.join(APP_ID, CHANNEL, TOKEN, null);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(audioTrack);
        await client.publish([audioTrack]);
        startMonitoring();

        if (!isVideoOff) {
          const videoTrack = await AgoraRTC.createCameraVideoTrack();
          setLocalVideoTrack(videoTrack);
          await client.publish([videoTrack]);
          videoTrack.play('local-player');
        }

        setConnectionStatus('connected');
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);

          if (mediaType === 'video') {
            const container = document.getElementById('remote-player-container');
            container.innerHTML = '';
            user.videoTrack.play('remote-player-container');
          }

          if (mediaType === 'audio') {
            user.audioTrack.play();
          }
        });

        client.on('user-unpublished', () => {
          const container = document.getElementById('remote-player-container');
          if (container) container.innerHTML = '';
        });

      } catch (error) {
        console.error('Agora init failed:', error);
        setModalTitle('Connection Error');
        setModalMessage('Failed to connect to video session.');
        setModalFooter(null);
        setModalType('info');
        setShowModal(true);
      }
    };

    initAgora();

    return () => {
      const cleanup = async () => {
        localVideoTrack?.stop();
        localVideoTrack?.close();
        localAudioTrack?.stop();
        localAudioTrack?.close();
        stopMonitoring();
        await client.leave();
      };
      cleanup();
    };
  }, []);

  const toggleMute = () => {
    if (localAudioTrack) {
      const muted = !isMuted;
      localAudioTrack.setEnabled(!muted);
      setIsMuted(muted);
    }
  };

  const toggleVideo = async () => {
    if (isVideoOff) {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      setLocalVideoTrack(videoTrack);
      await client.publish([videoTrack]);
      videoTrack.play('local-player');
      setIsVideoOff(false);
    } else {
      localVideoTrack?.stop();
      localVideoTrack?.close();
      await client.unpublish([localVideoTrack]);
      setLocalVideoTrack(null);
      setIsVideoOff(true);
    }
  };


  const toggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen?.().catch(err => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen?.().catch(err => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
    setIsFullScreen(!isFullScreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const endCall = async () => {
    setModalTitle('End Consultation');
    setModalMessage('Are you sure you want to end this consultation?');
    setModalFooter(
      <div className='buttons'>
        <button className="btn btn-danger"
          onClick={() => setShowModal(false)}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            localVideoTrack?.stop();
            localVideoTrack?.close();
            localAudioTrack?.stop();
            localAudioTrack?.close();
            stopMonitoring();
            await client.leave();
            setIsMuted(true);
            setIsVideoOff(true);
            navigate('/booking');
            setShowModal(false);
            window.location.reload();
          }}
        >
          End Call
        </button>
      </div>
    );
    setModalType('confirm');
    setShowModal(true);
  };


  return (
    <div className={`video-screen ${isFullScreen ? 'fullscreen' : ''}`}>
      {connectionStatus === 'connecting' ? (
        <div className="connecting-overlay main-video">
          <div className="connecting-spinner"></div>
          <p>Connecting to Navatar...</p>
        </div>
      ) : (
        <>
          <div className="main-video">
            <div id="remote-player-container" className="remote-video-feed"></div>

            <div className="local-thumbnail">
              <div id="local-player" className="local-video-feed"></div>

              {isVideoOff && <div className="participant-label">{user.name}</div>
              }
              <MicrophoneLevelBar level={level} isMuted={isMuted} />

            </div>
          </div>

          <div className="video-controls">
            <button className={`control-button ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
              {isMuted ? '🔇' : '🔊'}
              <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button className={`control-button ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo}>
              {isVideoOff ? '📵' : '📹'}
              <span className="control-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </button>

            <button className="control-button" onClick={toggleFullScreen}>
              {isFullScreen ? '⬜' : '⬛'}
              <span className="control-label">{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            <button className="control-button end-call" onClick={endCall}>
              📞
              <span className="control-label">End Call</span>
            </button>

          </div>
        </>
      )}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalTitle}
        footer={modalFooter}
      >
        {modalMessage}
      </Modal>
    </div>
  );
}

export default VideoScreen;
