export default class VideoProcessor {
  #mp4Demuxer;
  #webMWriter;
  #service;
  #buffers = [];
  /**
   *
   * @param {object} options
   * @param {import('./mp4Demuxer.js').default} options.mp4Demuxer
   * @param {import('./../deps/webm-writer2.js').default} options.webMWriter
   * @param {import('./service.js').default} options.service
   */

  constructor({ mp4Demuxer, webMWriter, service }) {
    this.#mp4Demuxer = mp4Demuxer;
    this.#webMWriter = webMWriter;
    this.#service = service;
  }

  /** @returns {ReadableStream} */
  mp4Decoder(stream) {
    return new ReadableStream({
      // O controller vai ser o produtor de dados, ou seja, quem consumir o mp4Decoder vai receber o que o controller mandar.
      start: async (controller) => {
        const decoder = new VideoDecoder({
          /** @param {VideoFrame} frame */
          output(frame) {
            controller.enqueue(frame);
          },
          error(e) {
            console.error("error at mp4Decoder", e);
            controller.error(e);
          },
        });

        return this.#mp4Demuxer.run(stream, {
          async onConfig(config) {
            // const { supported } = await VideoDecoder.isConfigSupported(config);
            // if (!supported) {
            //   console.error(
            //     "mp4Muxer VideoDecoder config not supported!",
            //     config
            //   );
            //   controller.close();
            //   return;
            // }
            decoder.configure(config);
          },
          /** @param {EncodedVideoChunk} chunk */
          onChunk(chunk) {
            // Toda vez que for chamada vai cair no output do VideoDecoder.
            decoder.decode(chunk);
          },
        });
        // .then(() => {
        //   setTimeout(() => {
        //     controller.close();
        //   }, 1000);
        // });
      },
    });
  }

  // Encode o vídeo decoded para resolução 144p
  encode144p(encoderConfig) {
    let _encoder;
    const readable = new ReadableStream({
      start: async (controller) => {
        const { supported } = await VideoEncoder.isConfigSupported(
          encoderConfig
        );

        if (!supported) {
          const message = "encode144p VideoEncoder config not supported!";
          console.error(message, encoderConfig);
          controller.error(message);
          return;
        }

        _encoder = new VideoEncoder({
          // Chama output após terminar de encode o frame.
          // O config é a configuração do decoder que explica como voltar essa informação para o original.
          // Ou a configuração para chegar nesse encoding.
          /**
           *
           * @param {EncodedVideoChunk} frame
           * @param {EncodedVideoChunkMetadata} config
           */
          output: (frame, config) => {
            if (config.decoderConfig) {
              const decoderConfig = {
                type: "config",
                config: config.decoderConfig,
              };
              controller.enqueue(decoderConfig);
            }
            controller.enqueue(frame);
          },
          error: (err) => {
            console.error("VideoEncoder 144p", err);
            controller.error(err);
          },
        });

        await _encoder.configure(encoderConfig);
      },
    });

    // Vai pegar os frames decoded e transformar em 144p.
    const writable = new WritableStream({
      async write(frame) {
        // Esse encode faz os dados caírem no output do VideoEncoder acima.
        _encoder.encode(frame);
        frame.close();
      },
    });

    return {
      readable,
      writable,
    };
  }

  // Vai renderizar os decoded frames no canvas.
  // Vamos precisar dos encoded chunks para o vídeo webM
  renderDecodedFramesAndGetEncodedChunks(renderFrame) {
    let _decoder;
    return new TransformStream({
      start: (controller) => {
        _decoder = new VideoDecoder({
          output(frame) {
            renderFrame(frame);
          },
          error(e) {
            console.error("error at renderFrames", e);
            controller.error(e);
          },
        });
      },
      /**
       *
       * @param {EncodedVideoChunk} encodedChunk
       * @param {TransformStreamDefaultController} controller
       */
      async transform(encodedChunk, controller) {
        if (encodedChunk.type === "config") {
          await _decoder.configure(encodedChunk.config);
          return;
        }
        _decoder.decode(encodedChunk);

        // need the encoded version to use webM
        controller.enqueue(encodedChunk);
      },
    });
  }

  transformIntoWebM() {
    const writable = new WritableStream({
      write: (chunk) => {
        this.#webMWriter.addFrame(chunk);
      },
      close() {
        debugger;
      },
    });

    return {
      readable: this.#webMWriter.getStream(),
      writable,
    };
  }

  upload(filename, resolution, type) {
    const chunks = [];
    let byteCount = 0;
    let segmentCount = 0;
    const triggerUpload = async (chunks) => {
      const blob = new Blob(chunks, { type: "video/webm" });

      // Fazer o upload
      await this.#service.uploadFile({
        filename: `${filename}-${resolution}.${++segmentCount}.${type}`,
        fileBuffer: blob,
      });
      // Vai remover todos os elementos
      // Gambiarra isso aqui!
      chunks.length = 0;
      byteCount = 0;
    };

    return new WritableStream({
      /**
       *
       * @param {object} options
       * @param {Uint8Array} options.data
       */
      async write({ data }) {
        chunks.push(data);
        byteCount += data.byteLength;

        // Se for menor que 10mb não faz upload.
        if (byteCount <= 10e6) return;
        await triggerUpload(chunks);
        // renderFrame(frame);
      },
      async close() {
        if (!chunks.length) return;
        await triggerUpload(chunks);
      },
    });
  }

  async start({ file, encoderConfig, renderFrame, sendMessage }) {
    const stream = file.stream();
    const fileName = file.name.split("/").pop().replace(".mp4", "");
    await this.mp4Decoder(stream)
      // pipeTrough para direcionar os dados para uma transform stream.
      .pipeThrough(this.encode144p(encoderConfig))
      .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
      // pipeTo só aceita uma writable stream.
      .pipeThrough(this.transformIntoWebM())
      // Esse pipe é só para debug.
      // .pipeThrough(
      //   new TransformStream({
      //     transform: ({ data, position }, controller) => {
      //       this.#buffers.push(data);
      //       controller.enqueue(data);
      //     },
      //     flush: () => {
      //       // debugger;
      //       // sendMessage({
      //       //   status: "done",
      //       //   buffers: this.#buffers,
      //       //   filename: fileName.concat("-144p.webm"),
      //       // });
      //       sendMessage({
      //         status: "done",
      //       });
      //     },
      //   })
      // )
      .pipeTo(this.upload(fileName, "144p", "webm"));

    sendMessage({
      status: "done",
    });
    // .pipeTo(
    //   new WritableStream({
    //     write(frame) {
    //       // debugger;
    //       // renderFrame(frame);
    //     },
    //   })
    // );
  }
}
