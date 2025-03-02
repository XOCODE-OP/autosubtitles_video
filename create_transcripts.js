require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { spawn, exec } = require('child_process');

// Converts seconds into ASS timestamp format (hh:mm:ss.xx)
function secondsToTimestamp(seconds) {
    const date = new Date(null);
    date.setSeconds(seconds);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(Math.floor((seconds % 1) * 100)).padStart(2, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

// Group word objects into chunks of maxWords words.
// Each chunk's start time is the start of the first word,
// and its end time is the end of the last word.
function groupWords(words, maxWords = 5) {
    const groups = [];
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords);
      const text = chunk.map(obj => obj.word).join(' ');
      const start = chunk[0].start;
      const end = chunk[chunk.length - 1].end;
      groups.push({ text, start, end });
    }
    return groups;
}

// Formats a dialogue chunk into two ASS dialogue lines.
function formatDialogue(chunk, styleBackdrop, styleDefault) {
    const startTime = secondsToTimestamp(chunk.start);
    const endTime = secondsToTimestamp(chunk.end);

    const randomAngle = (Math.random() * 24 - 12).toFixed(0);

    // You can adjust override tags and styles as needed.
    const backdropLine = `Dialogue: 0,${startTime},${endTime},${styleBackdrop},,0000,0000,0000,,{\\frz${randomAngle}\\fscx0\\fscy0\\t(0,80,\\fscx100\\fscy100)\\be1}${chunk.text.toUpperCase()}`;
    const defaultLine  = `Dialogue: 0,${startTime},${endTime},${styleDefault},,0000,0000,0000,,{\\frz${randomAngle}\\fscx0\\fscy0\\t(0,80,\\fscx100\\fscy100)}${chunk.text.toUpperCase()}`;
    return [backdropLine, defaultLine, "\n"];
}

async function transcribe(audioFile)
{
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word"]
      });
      return transcription;
}

async function ffmpegExtractAudio(videoFile)
{
    return new Promise((resolve, reject) => {
        ffmpeg = spawn('ffmpeg', [
            '-y', // Overwrite the output file if it exists
            '-hide_banner',
            '-i', videoFile,
            '-vn', // Disable video recording
            './input_audio.mp3' // Output file path
        ]);
        ffmpeg.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
        });
        ffmpeg.stderr.on('data', (data) => {
            //console.error(`FFmpeg stderr: ${data}`);
        });
        ffmpeg.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            resolve();
        });
    });
}

async function main()
{
    let audioFile = "./input_audio.mp3";
    let videoFile = "./input_video.mp4";

    console.log("Extracting audio from video...");
    await ffmpegExtractAudio(videoFile);

    console.log("Transcribing audio...");
    const transcription = await transcribe(audioFile);
  
    // Assuming transcription.words is an array of word objects.
    // If the API nests words inside segments, you may need to flatten them.
    const words = transcription.words || transcription.segments.flatMap(seg => seg.words);
    
    // Group the words into smaller chunks (here, 4 words per chunk).
    const chunks = groupWords(words, 4);
    
    // Define your ASS styles.
    const styleBackdrop = "backdrop";
    const styleDefault  = "Default";
    
    const dialogueLines = [];
    chunks.forEach(chunk => {
        dialogueLines.push(...formatDialogue(chunk, styleBackdrop, styleDefault));
    });
    
    let ASSfileString = `[Script Info]
Title: Custom Styled Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

[V4+ Styles]
; Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,THE BOLD FONT (FREE VERSION),100,&H00FFFFFF,&H0000FF00,&H00,&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,2,0,0,120,1
Style: backdrop,THE BOLD FONT (FREE VERSION),100,&H00,&H00,&H00,&H00,-1,0,0,0,100,100,0,0,0,0,0,2,30,0,112,1

[Events]
; Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    for (let i = 0; i < dialogueLines.length; i++) {
        ASSfileString += '\n' + dialogueLines[i];
    }
    fs.writeFileSync("./out.ass", ASSfileString, "utf-8");
    console.log("FILE WRITTEN", "./out.ass");


}
main();

