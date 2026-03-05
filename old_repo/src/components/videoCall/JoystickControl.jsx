import { useState, useRef, useEffect } from 'react';
import './JoystickControl.css';
import mqttClient from './mqttClient';

function JoystickControl() {
  const [botStatus, setBotStatus] = useState('Waiting for Bot');
  const joystickRef = useRef(null);
  const handleRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [direction, setDirection] = useState('Stopped');
  const [robotStatus, setRobotStatus] = useState('Calibrating...');
  const [mqttStatus, setMqttStatus] = useState('Connecting...');

  // Setup MQTT connection monitoring
  useEffect(() => {
    let isSubscribed = false;

    const handleConnect = () => {
      console.log('✅ MQTT connected');
      setMqttStatus('Connected');

      // Add a small delay and check if client is still connected before subscribing
      setTimeout(() => {
        if (mqttClient.connected && !isSubscribed) {
          mqttClient.subscribe('bot/status', (err) => {
            if (!err) {
              console.log('✅ Successfully subscribed to bot/status');
              isSubscribed = true;
            } else {
              console.error('❌ Subscription error:', err);
            }
          });
        }
      }, 100);
    };

    const handleDisconnect = () => {
      console.log('❌ MQTT disconnected');
      setMqttStatus('Disconnected');
      setBotStatus('Waiting for Bot');
      isSubscribed = false;
    };

    const handleError = (error) => {
      console.error('❌ MQTT Error:', error);
      setMqttStatus('Error');
    };

    const handleMessage = (topic, message) => {
      console.log('📨 Received message:', topic, message.toString());

      if (topic === 'bot/status') {
        const status = message.toString();
        console.log('📡 Bot status:', status);
        if (status === 'connected') {
          setBotStatus('Ready');
        } else if (status === 'moving') {
          setBotStatus('Moving');
        } else if (status === 'stopped') {
          setBotStatus('Idle');
        } else if (status === 'disconnected') {
          setBotStatus('Disconnected');
        }
      }
    };

    // Add event listeners
    mqttClient.on('connect', handleConnect);
    mqttClient.on('disconnect', handleDisconnect);
    mqttClient.on('error', handleError);
    mqttClient.on('message', handleMessage);

    // If already connected, handle it
    if (mqttClient.connected) {

      handleConnect();
    }

    // Cleanup function
    return () => {
      mqttClient.off('connect', handleConnect);
      mqttClient.off('disconnect', handleDisconnect);
      mqttClient.off('error', handleError);
      mqttClient.off('message', handleMessage);

      // Don't call mqttClient.end() here as it might be used by other components
    };
  }, []); // Empty dependency array

  // Calculate speed and direction from position
  useEffect(() => {
    const distance = Math.sqrt(position.x ** 2 + position.y ** 2);
    const maxDistance = 50;
    let normalizedSpeed = Math.min(Math.round((distance / maxDistance) * 100), 100);

    // Apply a dead zone: treat anything below 15% as STOP
    if (normalizedSpeed < 15) {
      normalizedSpeed = 0;
    }

    setSpeed(normalizedSpeed);

    let newDirection = 'Stopped';
    if (normalizedSpeed > 0) {
      const angle = Math.atan2(-position.y, position.x) * (180 / Math.PI);
      if (angle >= -22.5 && angle < 22.5) newDirection = 'Right';
      else if (angle >= 22.5 && angle < 67.5) newDirection = 'Forward-Right';
      else if (angle >= 67.5 && angle < 112.5) newDirection = 'Forward';
      else if (angle >= 112.5 && angle < 157.5) newDirection = 'Forward-Left';
      else if (angle >= 157.5 || angle < -157.5) newDirection = 'Left';
      else if (angle >= -157.5 && angle < -112.5) newDirection = 'Backward-Left';
      else if (angle >= -112.5 && angle < -67.5) newDirection = 'Backward';
      else if (angle >= -67.5 && angle < -22.5) newDirection = 'Backward-Right';
    }

    setDirection(newDirection);
    setRobotStatus(normalizedSpeed > 0 ? 'Moving' : 'Ready');

    // Only publish if connected and not disconnecting
    if (mqttClient.connected) {
      // Create and adjust the command
      const command = {
        direction: normalizedSpeed === 0 ? 'Stop' : newDirection,
        speed: normalizedSpeed
      };

      // Only publish meaningful commands
      mqttClient.publish('robot/control', JSON.stringify(command), (err) => {
        if (!err) {
          console.log('📤 Published command:', command);
        } else {
          console.error('❌ Publish error:', err);
        }
      });
    }

  }, [position]);

  // ... rest of your component code remains the same ...
  const handleStart = (x, y) => {
    if (!joystickRef.current) return;
    setIsDragging(true);
    const rect = joystickRef.current.getBoundingClientRect();
    updateHandlePosition(x, y, rect);
  };

  const handleMove = (x, y) => {
    if (!isDragging || !joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    updateHandlePosition(x, y, rect);
  };

  const updateHandlePosition = (x, y, rect) => {
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    let dx = x - rect.left - centerX;
    let dy = y - rect.top - centerY;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    const maxDistance = 50;

    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxDistance;
      dy = Math.sin(angle) * maxDistance;
    }
    setPosition({ x: dx, y: dy });
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = e => handleStart(e.clientX, e.clientY);
  const onMouseMove = e => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleEnd();
  const onTouchStart = e => e.touches[0] && handleStart(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = e => e.touches[0] && handleMove(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchEnd = () => handleEnd();

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  return (
    <div className="joystick-container">
      <div className="connection-status">
        <p>MQTT: <span className={mqttStatus.toLowerCase()}>{mqttStatus}</span></p>
        <p>Bot: <span className={botStatus === 'Ready' ? 'ready' : 'waiting'}>{botStatus}</span></p>
      </div>

      {/* <div className="joystick-title">
        <h3>Robot Controls</h3>
      </div> */}

      <div className="joystick-stats">
        <div className="stat">
          <span className="stat-label">Direction:</span>
          <span className="stat-value">{direction}</span>
        </div>
      </div>

      <div
        className="joystick-base"
        ref={joystickRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="joystick-direction-indicator forward">▲</div>
        <div className="joystick-direction-indicator right">▶</div>
        <div className="joystick-direction-indicator backward">▼</div>
        <div className="joystick-direction-indicator left">◀</div>

        <div
          ref={handleRef}
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          className={` joystick-handle ${botStatus} === 'Ready' ? ready : waiting`}
        ></div>
      </div>

      <div className="control-instructions">
        <p>Click and drag joystick to navigate robot</p>
        <p>Release to stop movement</p>
      </div>
    </div>
  );
}

export default JoystickControl;