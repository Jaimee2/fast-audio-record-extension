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

    const audioUrl = URL.createObjectURL(audioBlob);

    const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
    const filename = `audio-recording-${timestamp}.webm`;

    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    chrome.runtime.sendMessage({ action: "recording-stopped" });

    closeRecorder();
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

