let recorderWindowId = null;
let isRecording = false;


chrome.commands.onCommand.addListener((command) => {
    console.log(command)
    switch (command) {
        case "toggle-recording":
            createWindowRecorder();
            break;
        case "toggle-stop":
            chrome.runtime.sendMessage({action: "stop-recording"});
            break;
    }
});

function createWindowRecorder() {
    chrome.windows.create({
        url: chrome.runtime.getURL("recorder.html"),
        type: "popup",
        focused: false,
        height: 100,
        width: 100
    }, (newWindow) => {
        recorderWindowId = newWindow.id;
        isRecording = true;
    });
}


chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === "recording-stopped") {
        isRecording = false;
        if (sender.tab) {
            chrome.windows.remove(sender.tab.windowId);
        } else if (recorderWindowId !== null) {
            chrome.windows.remove(recorderWindowId);
            recorderWindowId = null;
        }
    }
});
