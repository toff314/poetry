#!/usr/bin/env node
/**
 * TTS Converter using node-edge-tts
 *
 * Converts text to speech using Microsoft Edge's online TTS service.
 * Supports multiple voices, languages, speeds, and output formats.
 *
 * Usage:
 *   node tts-converter.js "Your text here" --voice en-US-AriaNeural --rate +10% --output audio.mp3
 */

const { EdgeTTS } = require('node-edge-tts');
const { program } = require('commander');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Constants
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_TEXT_LENGTH = 10000;
const CHUNK_SIZE = 2000;
const TEMP_DIR = path.join(os.tmpdir(), 'edge-tts-temp');

// Default voice configurations
const DEFAULT_VOICES = {
  en: 'en-US-MichelleNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  it: 'it-IT-ElsaNeural',
  ja: 'ja-JP-NanamiNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ar: 'ar-SA-ZariyahNeural',
};

/**
 * Validate prosody value (pitch, rate, volume)
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid
 */
function validateProsodyValue(value) {
  if (value === 'default') return true;
  if (typeof value === 'string' && value.endsWith('%')) {
    const num = parseInt(value);
    return !isNaN(num) && num >= -100 && num <= 100;
  }
  return false;
}

/**
 * Ensure temp directory exists
 * @returns {Promise<void>}
 */
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch (error) {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

/**
 * Generate unique temporary file path
 * @param {string} extension - File extension (e.g., '.mp3')
 * @returns {string} Temporary file path
 */
function generateTempPath(extension = '.mp3') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `tts_${timestamp}_${random}${extension}`;
  return path.join(TEMP_DIR, filename);
}

/**
 * Split text into chunks for long content processing
 * @param {string} text - Full text to split
 * @param {number} chunkSize - Maximum characters per chunk
 * @returns {string[]} Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize = CHUNK_SIZE) {
  if (text.length <= chunkSize) return [text];
  
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > chunkSize) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  
  console.log(`Split text into ${chunks.length} chunks (${text.length} chars total, ~${chunkSize} chars per chunk)`);
  return chunks;
}

/**
 * Merge multiple MP3 files using ffmpeg
 * @param {string[]} chunkFiles - Array of chunk MP3 file paths
 * @param {string} outputPath - Final output path
 * @returns {Promise<void>}
 */
async function mergeMp3Files(chunkFiles, outputPath) {
  if (chunkFiles.length === 1) {
    await fs.rename(chunkFiles[0], outputPath);
    return;
  }
  
  const listFile = generateTempPath('.txt');
  const fileList = chunkFiles.map(f => `file '${f}'`).join('\n');
  await fs.writeFile(listFile, fileList);
  
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`, {
      stdio: 'pipe',
      timeout: 60000,
    });
    console.log(`Merged ${chunkFiles.length} chunks into: ${outputPath}`);
  } catch (err) {
    throw new Error(`ffmpeg merge failed: ${err.message}. Ensure ffmpeg is installed.`);
  } finally {
    await fs.unlink(listFile).catch(() => {});
    for (const f of chunkFiles) await fs.unlink(f).catch(() => {});
  }
}

/**
 * Convert text to speech with chunking for long content
 * @param {string} text - Text to convert
 * @param {object} options - TTS options
 * @returns {Promise<string>} Path to generated audio file
 */
async function textToSpeech(text, options = {}) {
  const {
    voice,
    lang = 'en-US',
    outputFormat = 'audio-24khz-48kbitrate-mono-mp3',
    pitch = 'default',
    rate = 'default',
    volume = 'default',
    saveSubtitles = false,
    outputPath = null,
    proxy,
    timeout = DEFAULT_TIMEOUT_MS,
    chunkSize = CHUNK_SIZE,
  } = options;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
  
  if (!validateProsodyValue(pitch)) {
    throw new Error(`Invalid pitch value: "${pitch}"`);
  }
  if (!validateProsodyValue(rate)) {
    throw new Error(`Invalid rate value: "${rate}"`);
  }
  if (!validateProsodyValue(volume)) {
    throw new Error(`Invalid volume value: "${volume}"`);
  }
  
  if (timeout && timeout <= 0) {
    throw new Error(`Invalid timeout: ${timeout}`);
  }

  const finalVoice = voice || DEFAULT_VOICES[lang.split('-')[0]] || DEFAULT_VOICES.en;
  const finalLang = finalVoice.includes('zh-CN') ? 'zh-CN' : 
                     finalVoice.includes('en-US') ? 'en-US' : 
                     finalVoice.includes('en-GB') ? 'en-GB' : lang;
  await ensureTempDir();
  const finalOutputPath = outputPath || generateTempPath('.mp3');

  const ttsKeywords = ['tts', 'text-to-speech', 'text to speech'];
  
  let filteredText = text;
  
  filteredText = filteredText
    .replace(/!\[.*?\]\(.*?\)/g, '')          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')    .replace(/^#{1,6}\s+/gm, '')                .replace(/^>\s+/gm, '')                     .replace(/\*\*([^*]+)\*\*/g, '$1')          .replace(/\*([^*]+)\*/g, '$1')              .replace(/`([^`]+)`/g, '$1')                .replace(/^[-]{3,}$/gm, '')                 .replace(/[|]/g, ' ')                       .replace(/[•·]/g, ' ')                      .replace(/[""]/g, "'")                      .replace(/['']/g, "'")                      .replace(/[——]/g, '-')                      .replace(/\n{3,}/g, '\n\n')                 .trim();

  const chunks = splitTextIntoChunks(filteredText, chunkSize);
  const chunkFiles = [];

  console.log(`Converting ${chunks.length} text chunks to speech...`);
  console.log(`  Voice: ${finalVoice}, Language: ${finalLang}, Rate: ${rate}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = generateTempPath('.mp3');
    console.log(`  Chunk ${i + 1}/${chunks.length}: ${chunks[i].substring(0, 30)}... (${chunks[i].length} chars)`);
    
    const tts = new EdgeTTS({
      voice: finalVoice,
      lang: finalLang,
      outputFormat,
      saveSubtitles,
      proxy,
      timeout,
      pitch,
      rate,
      volume,
    });
    
    try {
      await tts.ttsPromise(chunks[i], chunkPath);
      chunkFiles.push(chunkPath);
    } catch (err) {
      console.error(`Chunk ${i + 1} failed:`, err);
      for (const f of chunkFiles) await fs.unlink(f).catch(() => {});
      throw new Error(`TTS failed at chunk ${i + 1}: ${err.message || err}`);
    }
  }

  await mergeMp3Files(chunkFiles, finalOutputPath);

  const stats = await fs.stat(finalOutputPath);
  console.log(`\n✓ Audio saved to: ${finalOutputPath}`);
  console.log(`✓ File size: ${stats.size} bytes`);

  return finalOutputPath;
}

/**
 * List available voices (shows common ones - full list available from Microsoft Edge service)
 */
function listVoices() {
  console.log('Common voices by language:\n');

  const voicesByLang = {
    'en': ['en-US-MichelleNeural', 'en-US-AriaNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural'],
    'es': ['es-ES-ElviraNeural', 'es-MX-DaliaNeural'],
    'fr': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
    'de': ['de-DE-KatjaNeural', 'de-DE-ConradNeural'],
    'it': ['it-IT-ElsaNeural'],
    'ja': ['ja-JP-NanamiNeural'],
    'zh': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunyangNeural'],
    'ar': ['ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'],
  };

  for (const [lang, voices] of Object.entries(voicesByLang)) {
    console.log(`${lang}:`);
    voices.forEach(v => console.log(`  ${v}`));
  }

  console.log('\nVoice name format: {lang}-{region}-{Name}{VoiceType}');
  console.log('Example: en-US-AriaNeural = English (US), Aria, Neural voice');
}

if (require.main === module) {
  program
    .argument('<text>', 'Text to convert to speech')
    .option('-v, --voice <voice>', 'Voice name (e.g., en-US-MichelleNeural)')
    .option('-l, --lang <language>', 'Language code (e.g., en-US, es-ES)', 'en-US')
    .option('-o, --format <format>', 'Output format (e.g., audio-24khz-48kbitrate-mono-mp3)', 'audio-24khz-48kbitrate-mono-mp3')
    .option('--pitch <pitch>', 'Pitch adjustment (e.g., +10%, -20%, default)', 'default')
    .option('-r, --rate <rate>', 'Rate adjustment (e.g., +10%, -20%, default)', 'default')
    .option('--volume <volume>', 'Volume adjustment (e.g., +0%, -50%, default)', 'default')
    .option('-s, --save-subtitles', 'Save subtitles as JSON file', false)
    .option('-f, --output <path>', 'Output file path (default: temp file in system temp dir)')
    .option('-p, --proxy <proxy>', 'Proxy URL (e.g., http://localhost:7890)')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
    .option('-L, --list-voices', 'List available voices')
    .description('Convert text to speech using node-edge-tts')
    .version('2.0.0');

  program.parse(process.argv);
  const options = program.opts();
  const text = program.args[0];

  if (options.listVoices) {
    listVoices();
    process.exit(0);
  }

  if (!text) {
    console.error('Error: No text provided');
    console.log('Usage: node tts-converter.js "Your text" [options]');
    console.log('Run: node tts-converter.js --list-voices to see available voices');
    process.exit(1);
  }

  textToSpeech(text, {
    voice: options.voice,
    lang: options.lang,
    outputFormat: options.format,
    pitch: options.pitch,
    rate: options.rate,
    volume: options.volume,
    saveSubtitles: options.saveSubtitles,
    outputPath: options.output,
    proxy: options.proxy,
    timeout: parseInt(options.timeout),
  }).catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = { textToSpeech, listVoices };