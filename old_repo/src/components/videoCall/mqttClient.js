// mqttClient.js
import mqtt from 'mqtt';

// Use the correct WebSocket URL format for HiveMQ Cloud
const client = mqtt.connect('wss://a9088c6daa9e41e4b8f965ad7fd902a5.s1.eu.hivemq.cloud:8884/mqtt', {
  username: 'yogin',
  password: 'Yogin@2004',
  clientId: 'web_client_' + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 30000
});

// Add detailed logging
client.on('connect', () => {
  console.log('✅ Web MQTT Client Connected');
});

client.on('error', (error) => {
  console.error('❌ Web MQTT Connection Error:', error);
});

client.on('offline', () => {
  console.log('📴 Web MQTT Client Offline');
});

client.on('close', () => {
  console.log('🔌 Web MQTT Connection Closed');
});

export default client;