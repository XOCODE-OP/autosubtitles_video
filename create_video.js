const fs = require('fs');
const { spawn, exec } = require('child_process');

async function main()
{
    let videoFile = "./input_video.mp4";

    console.log("Now rendering video...");

    async function renderVideo()
    {
        return new Promise((resolve, reject) => {
            ffmpeg = spawn('ffmpeg', [
                '-y', // Overwrite the output file if it exists
                '-hide_banner',
                '-i', videoFile,
                '-vf', 'ass=./out.ass',
                './video_out.mp4' // Output file path
            ]);
            ffmpeg.stdout.on('data', (data) => {
                console.log(`FFmpeg stdout: ${data}`);
            });
            ffmpeg.stderr.on('data', (data) => {
                //console.error(`FFmpeg stderr: ${data}`);
            });
            ffmpeg.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
                console.log("video rendered", "./video_out.mp4");
            });
        });
    }
    await renderVideo();

}
main();

