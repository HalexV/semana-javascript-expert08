import VideoProcessor from "./videoProcessor.js";
import MP4Demuxer from "./mp4Demuxer.js";
import CanvasRenderer from "./canvasRenderer.js";
import Service from "./service.js";

const qvgaConstraints = {
  width: 320,
  height: 240,
};

const vgaConstraints = {
  width: 640,
  height: 480,
};

const hdConstraints = {
  width: 1280,
  height: 720,
};

const encoderConfig = {
  video: {
    ...qvgaConstraints,
    bitrate: 10e6,
    // WebM
    codec: "vp09.00.10.08",
    pt: 4,
    hardwareAcceleration: "prefer-software",

    // MP4
    // codec: "avc1.42002A",
    // pt: 1,
    // hardwareAcceleration: "prefer-hardware",
    // avc: { format: "annexb" },
  },
  audio: {
    codec: "opus",
    sampleRate: 22050, // tem que pegar do vídeo original.
    numberOfChannels: 2,
    bitrate: 10e6,
  },
};

export const webMMuxerConfig = {
  video: {
    codec: "V_VP9",
    width: encoderConfig.video.width,
    height: encoderConfig.video.height,
  },
  audio: {
    codec: "A_OPUS",
    numberOfChannels: encoderConfig.audio.numberOfChannels,
    sampleRate: encoderConfig.audio.sampleRate,
  },
};

const mp4Demuxer = new MP4Demuxer();

const service = new Service({
  url: "http://localhost:3000",
});
const videoProcessor = new VideoProcessor({
  mp4Demuxer,
  service,
});

onmessage = async ({ data }) => {
  const renderFrame = CanvasRenderer.getRenderer(data.canvas);

  await videoProcessor.start({
    file: data.file,
    renderFrame,
    encoderConfig,
    sendMessage(message) {
      self.postMessage(message);
    },
  });

  // No navegador temos o window, no worker o self.
  // self.postMessage({
  //   status: "done",
  // });
};
