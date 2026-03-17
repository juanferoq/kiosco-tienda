const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const CLAUDE_API_KEY      = (process.env.CLAUDE_API_KEY      || '').trim();
const ELEVENLABS_API_KEY  = (process.env.ELEVENLABS_API_KEY  || '').trim();
const ELEVENLABS_VOICE_ID = (process.env.ELEVENLABS_VOICE_ID || '').trim();
const HEYGEN_API_KEY      = (process.env.HEYGEN_API_KEY      || '').trim();
const HEYGEN_AVATAR_ID    = (process.env.HEYGEN_AVATAR_ID    || '').trim();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/claude', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const { messages, system } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, system, messages })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Claude error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const { text } = req.body;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('ElevenLabs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/heygen/generate', async (req, res) => {
  if (!HEYGEN_API_KEY) return res.status(503).json({ error: 'HeyGen no configurado' });
  try {
    const { default: fetch } = await import('node-fetch');
    const { audioBase64 } = req.body;
    const uploadRes = await fetch('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/mpeg', 'X-Api-Key': HEYGEN_API_KEY },
      body: Buffer.from(audioBase64, 'base64')
    });
    const uploadData = await uploadRes.json();
    const assetId = uploadData.data?.id;
    if (!assetId) throw new Error('No se pudo subir el audio');
    const videoRes = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': HEYGEN_API_KEY },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: 'avatar', avatar_id: HEYGEN_AVATAR_ID, avatar_style: 'normal' },
          voice: { type: 'audio', audio_asset_id: assetId }
        }],
        dimension: { width: 400, height: 400 }
      })
    });
    const videoData = await videoRes.json();
    res.json(videoData);
  } catch (err) {
    console.error('HeyGen generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/heygen/status/:videoId', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${req.params.videoId}`,
      { headers: { 'X-Api-Key': HEYGEN_API_KEY } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('HeyGen status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Servidor corriendo en puerto ' + PORT);
  console.log('Claude key: ' + (CLAUDE_API_KEY ? '✅ configurada' : '❌ FALTA'));
  console.log('ElevenLabs key: ' + (ELEVENLABS_API_KEY ? '✅ configurada' : '❌ FALTA'));
  console.log('ElevenLabs voice: ' + (ELEVENLABS_VOICE_ID ? '✅ configurada' : '❌ FALTA'));
  console.log('HeyGen key: ' + (HEYGEN_API_KEY ? '✅ configurada' : '❌ FALTA'));
  console.log('HeyGen avatar: ' + (HEYGEN_AVATAR_ID ? '✅ configurada' : '❌ FALTA'));
});
