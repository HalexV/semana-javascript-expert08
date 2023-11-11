import { createFile, DataStream } from "../deps/mp4box.0.5.2.js";

export default class MP4Demuxer {
  #onConfig;
  #onChunk;
  #videoFile;
  #audioFile;
  /**
   *
   * @param {ReadableStream} stream
   * @param {object} options
   * @param {(config: object) => void} options.onConfig
   *
   * @returns {Promise<void>}
   */
  async run(stream, { onConfig, onChunk }) {
    this.#onConfig = onConfig;
    this.#onChunk = onChunk;

    this.#videoFile = createFile();
    this.#videoFile.onReady = this.#onVideoReady.bind(this);
    this.#videoFile.onSamples = this.#onVideoSamples.bind(this);
    this.#videoFile.onError = (error) =>
      console.error("deu ruim video mp4Demuxer", error);

    this.#audioFile = createFile();
    this.#audioFile.onReady = this.#onAudioReady.bind(this);
    this.#audioFile.onSamples = this.#onAudioSamples.bind(this);
    this.#audioFile.onError = (error) =>
      console.error("deu ruim audio mp4Demuxer", error);

    return this.#init(stream);
  }

  #videoDescription({ id }) {
    const track = this.#videoFile.getTrackById(id);

    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8); // Remove the box header.
      }
    }
    throw new Error("avcC, hvcC, vpcC, or av1C box not found");
  }

  // Transforma de volta na resolução que nós queremos.
  #onVideoSamples(trackId, ref, samples) {
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
      // console.log(
      //   "sample.is_sync ? key : delta===",
      //   sample.is_sync ? "key" : "delta"
      // );
      // debugger;
      this.#onChunk({
        video: new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (1e6 * sample.cts) / sample.timescale,
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data,
        }),
      });
    }
  }

  #onVideoReady(info) {
    // debugger;
    const [videoTrack] = info.videoTracks;

    // const a = this.#videoFile.getTrackById(audioTrack.id);
    // const b = this.#videoFile.getTrackById(track.id);

    // debugger;
    // Esse config vai passar a informação necessária para o encoder do navegador consiga trabalhar com esse vídeo.
    this.#onConfig({
      video: {
        codec: videoTrack.codec,
        codedHeight: videoTrack.video.height,
        codedWidth: videoTrack.video.width,
        description: this.#videoDescription(videoTrack),
      },
    });

    this.#videoFile.setExtractionOptions(videoTrack.id);
    // MP4Box começar a segmentar
    this.#videoFile.start();
  }

  // Transforma de volta na resolução que nós queremos.
  #onAudioSamples(trackId, ref, samples) {
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
      // debugger;
      this.#onChunk({
        audio: new EncodedAudioChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (1e6 * sample.cts) / sample.timescale,
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data,
        }),
      });
    }
  }

  #onAudioReady(info) {
    // debugger;
    const [audioTrack] = info.audioTracks;

    // const a = this.#videoFile.getTrackById(audioTrack.id);
    // const b = this.#videoFile.getTrackById(track.id);

    // debugger;
    // Esse config vai passar a informação necessária para o encoder do navegador consiga trabalhar com esse vídeo.
    this.#onConfig({
      audio: {
        codec: audioTrack.codec,
        sampleRate: audioTrack.audio.sample_rate,
        numberOfChannels: audioTrack.audio.channel_count,
        // description: this.#audioDescription(audioTrack),
      },
    });

    this.#audioFile.setExtractionOptions(audioTrack.id);
    // MP4Box começar a segmentar
    this.#audioFile.start();
  }

  /**
   *
   * @param {ReadableStream} stream
   * @returns {Promise<void>}
   */
  #init(stream) {
    let _offset = 0;
    const consumeFile = new WritableStream({
      /** @param {Uint8Array} chunk */
      write: (chunk) => {
        const copy = chunk.buffer;
        copy.fileStart = _offset;
        this.#videoFile.appendBuffer(copy);
        this.#audioFile.appendBuffer(copy);

        _offset += chunk.length;
      },
      close: () => {
        this.#videoFile.flush();
        this.#audioFile.flush();
      },
    });

    return stream.pipeTo(consumeFile);
  }
}
