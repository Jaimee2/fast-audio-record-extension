let mediaRecorder = null;
let stream = null;
let audioChunks = [];
let startTime = null;

startRecording();

function startRecording() {
    console.log("Starting recording....")
    chrome.tabCapture.capture({ audio: true, video: false }, (capturedStream) => {
        console.log(capturedStream)
        if (!capturedStream) {
            console.error("Failed to capture tab audio");
            closeRecorder();
            return;
        }

        const audioPlayer = new Audio();
        audioPlayer.srcObject = capturedStream;
        audioPlayer.play()
            .catch(err => {
            console.error("Playback error:", err);
        });

        stream = capturedStream;
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        startTime = new Date();

        mediaRecorder.addEventListener("dataavailable", (event) => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        });

        mediaRecorder.addEventListener("stop", onRecordingStop);

        mediaRecorder.start();
    });
}

function onRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

    // Convert WebM to MP3
    convertToMp3(audioBlob)
        .then(mp3Blob => {
            const audioUrl = URL.createObjectURL(mp3Blob);

            const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
            const filename = `audio-recording-${ timestamp }.mp3`; // Changed to .mp3

            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            chrome.runtime.sendMessage({action: "recording-stopped"});

            closeRecorder();
        })
        .catch(error => {
            console.error("Error converting to MP3:", error);
            // Fallback to original WebM if conversion fails
            const audioUrl = URL.createObjectURL(audioBlob);

            const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
            const filename = `audio-recording-${ timestamp }.webm`;

            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            chrome.runtime.sendMessage({action: "recording-stopped"});

            closeRecorder();
        });
}

// Function to convert WebM to MP3
async function convertToMp3(webmBlob) {
    // We'll need to use the lamejs library for MP3 encoding
    // Make sure to include it in your extension via your manifest.json
    // For example: "content_scripts": [{ "js": ["lamejs.min.js", "your-script.js"] }]

    // First, convert the Blob to an ArrayBuffer
    const arrayBuffer = await webmBlob.arrayBuffer();

    // Create an AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get the raw audio data
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    // Create the MP3 encoder
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, sampleRate, 128);

    // Process the audio in chunks to avoid memory issues
    const mp3Data = [];
    const chunkSize = 1152; // Must be divisible by 576 for lamejs

    for (let i = 0; i < leftChannel.length; i += chunkSize) {
        // Convert float32 to int16
        const leftChunk = new Int16Array(chunkSize);
        const rightChunk = new Int16Array(chunkSize);

        for (let j = 0; j < chunkSize; j++) {
            if (i + j < leftChannel.length) {
                // Scale to int16 range and convert
                leftChunk[j] = Math.max(-1, Math.min(1, leftChannel[i + j])) * 0x7FFF;
                rightChunk[j] = Math.max(-1, Math.min(1, rightChannel[i + j])) * 0x7FFF;
            }
        }

        // Encode the chunks
        const mp3buf = audioBuffer.numberOfChannels === 1
            ? mp3encoder.encodeBuffer(leftChunk)
            : mp3encoder.encodeBuffer(leftChunk, rightChunk);

        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    // Finish encoding and get the last chunk
    const finalMp3buf = mp3encoder.flush();
    if (finalMp3buf.length > 0) {
        mp3Data.push(finalMp3buf);
    }

    // Concatenate all chunks into a single Uint8Array
    let totalLength = 0;
    for (let i = 0; i < mp3Data.length; i++) {
        totalLength += mp3Data[i].length;
    }

    const mp3Array = new Uint8Array(totalLength);
    let offset = 0;
    for (let i = 0; i < mp3Data.length; i++) {
        mp3Array.set(mp3Data[i], offset);
        offset += mp3Data[i].length;
    }

    // Create the MP3 Blob
    return new Blob([mp3Array], {type: "audio/mp3"});
}


function closeRecorder() {
    window.close();
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "stop-recording") {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }
});

