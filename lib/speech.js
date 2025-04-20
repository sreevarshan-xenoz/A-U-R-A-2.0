// Speech-to-Text (Web Speech API)
export function initSpeechRecognition(onResult, onEnd) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error('Speech recognition not supported in this browser');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (onResult) onResult(transcript);
  };
  
  recognition.onend = () => {
    if (onEnd) onEnd();
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
  };
  
  return recognition;
}

// Text-to-Speech (Web Speech API)
let speechSynthesis = null;
let speechVoice = null;

export function initSpeechSynthesis() {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported in this browser');
    return;
  }
  
  speechSynthesis = window.speechSynthesis;
  
  // Get the first English voice
  const voices = speechSynthesis.getVoices();
  speechVoice = voices.find(voice => voice.lang.includes('en-')) || voices[0];
  
  // If voices aren't loaded yet, wait for them
  if (voices.length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const updatedVoices = speechSynthesis.getVoices();
      speechVoice = updatedVoices.find(voice => voice.lang.includes('en-')) || updatedVoices[0];
    });
  }
}

export function speak(text, rate = 1.5) {
  if (!speechSynthesis) {
    console.error('Speech synthesis not initialized');
    return;
  }
  
  // Stop any current speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = speechVoice;
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  speechSynthesis.speak(utterance);
  
  return utterance;
}

export function stopSpeaking() {
  if (speechSynthesis) {
    speechSynthesis.cancel();
  }
} 