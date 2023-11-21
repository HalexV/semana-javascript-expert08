import { createFile } from "../deps/mp4box.0.5.2.js";

export default class MP4Demuxer {
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
  async run(stream, { onChunk }) {
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

  // Transforma de volta na resolução que nós queremos.
  #onVideoSamples(trackId, ref, samples) {
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
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
