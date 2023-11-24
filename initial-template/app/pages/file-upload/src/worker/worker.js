import VideoProcessor from "./videoProcessor.js";
import MP4Demuxer from "./mp4Demuxer.js";
import CanvasRenderer from "./canvasRenderer.js";
import Service from "./service.js";
import GetMp4Info from "./getMp4Info.js";

const qvgaConstraints = {
  width: 320,
  height: 240,
  bitrate: 150e3,
};

const vgaConstraints = {
  width: 640,
  height: 480,
  bitrate: 512e3,
};

const hdConstraints = {
  width: 1280,
  height: 720,
  bitrate: 1024e3,
};

const encoderConfig240p = {
  video: {
    ...qvgaConstraints,
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
  },
};

const encoderConfig480p = {
  video: {
    ...vgaConstraints,
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
  },
};

const encoderConfig720p = {
  video: {
    ...hdConstraints,
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
  },
};

const getMp4Info = new GetMp4Info();
const mp4Demuxer = new MP4Demuxer();

const service = new Service({
  url: "http://localhost:3000",
});

onmessage = async ({ data }) => {
  const renderFrame = CanvasRenderer.getRenderer(data.canvas);

  let mp4OriginalInfo;
  await getMp4Info.run(data.file.stream(), (config) => {
    mp4OriginalInfo = config;
  });

  // debugger;

  if (mp4OriginalInfo.video.codedHeight >= 240) {
    const videoProcessor = new VideoProcessor({
      mp4Demuxer,
      mp4OriginalInfo,
      encoderConfig: encoderConfig240p,
      service,
    });

    await videoProcessor.start({
      file: data.file,
      renderFrame,
      resolution: "240p",
    });
  }

  if (mp4OriginalInfo.video.codedHeight >= 480) {
    const videoProcessor = new VideoProcessor({
      mp4Demuxer,
      mp4OriginalInfo,
      encoderConfig: encoderConfig480p,
      service,
    });

    await videoProcessor.start({
      file: data.file,
      renderFrame,
      resolution: "480p",
    });
  }

  if (mp4OriginalInfo.video.codedHeight >= 720) {
    const videoProcessor = new VideoProcessor({
      mp4Demuxer,
      mp4OriginalInfo,
      encoderConfig: encoderConfig720p,
      service,
    });

    await videoProcessor.start({
      file: data.file,
      renderFrame,
      resolution: "720p",
    });
  }

  // No navegador temos o window, no worker o self.
  self.postMessage({
    status: "done",
  });
};
