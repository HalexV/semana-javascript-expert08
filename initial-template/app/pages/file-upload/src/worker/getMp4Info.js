import { createFile, DataStream } from "../deps/mp4box.0.5.2.js";

export default class GetMp4Info {
  #onConfig;
  #mp4File;
  #isFinished;
  /**
   *
   * @param {ReadableStream} stream
   * @param {object} options
   * @param {(config: object) => void} options.onConfig
   *
   * @returns {Promise<void>}
   */
  async run(stream, onConfig) {
    this.#onConfig = onConfig;

    this.#mp4File = createFile();
    this.#mp4File.onReady = this.#onReady.bind(this);
    this.#mp4File.onError = (error) =>
      console.error("deu ruim get mp4 info", error);

    return this.#init(stream);
  }

  #videoDescription({ id }) {
    const track = this.#mp4File.getTrackById(id);

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

  #onReady(info) {
    // debugger;
    const [videoTrack] = info.videoTracks;
    const [audioTrack] = info.audioTracks;
    // debugger;
    // const a = this.#videoFile.getTrackById(audioTrack.id);
    // const b = this.#videoFile.getTrackById(track.id);

    // debugger;
    // Esse config vai passar a informação necessária para o encoder do navegador consiga trabalhar com esse vídeo.

    let audioBitrate = videoTrack.bitrate;

    if (audioTrack.bitrate) {
      audioBitrate = audioTrack.bitrate;
    }

    this.#onConfig({
      video: {
        codec: videoTrack.codec,
        codedHeight: videoTrack.video.height,
        codedWidth: videoTrack.video.width,
        description: this.#videoDescription(videoTrack),
        bitrate: videoTrack.bitrate,
      },
      audio: {
        codec: audioTrack.codec,
        sampleRate: audioTrack.audio.sample_rate,
        numberOfChannels: audioTrack.audio.channel_count,
        bitrate: audioBitrate,
        // description: this.#audioDescription(audioTrack),
      },
    });

    this.#isFinished = true;
  }

  /**
   *
   * @param {ReadableStream} stream
   * @returns {Promise<void>}
   */
  async #init(stream) {
    let _offset = 0;
    const consumeFile = new WritableStream({
      /** @param {Uint8Array} chunk */
      write: (chunk) => {
        const copy = chunk.buffer;
        copy.fileStart = _offset;
        this.#mp4File.appendBuffer(copy);

        _offset += chunk.length;
      },
      close: () => {
        this.#mp4File.flush();
      },
    });

    const writer = consumeFile.getWriter();
    const reader = stream.getReader();

    while (!this.#isFinished) {
      const { value } = await reader.read();

      writer.write(value);
    }

    await reader.cancel();
    await writer.close();
  }
}
