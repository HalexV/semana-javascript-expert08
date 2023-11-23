import { readdir, open, rm } from "node:fs/promises";
import StreamArray from "stream-json/streamers/StreamArray.js";
import { logger } from "./util.js";

export default async function makeWebmFile({ folder, filename }) {
  logger.info(`Start make webm file for ${filename}`);

  const regex = new RegExp(`^${filename}\\.\\d+\\.tmp`);

  const files = await readdir(folder);

  const tmpFileNames = files.filter((filename) => regex.test(filename));

  const finalFilefd = await open(`${folder}/${filename}.webm`, "w");

  for (const tmpFileName of tmpFileNames) {
    const fd = await open(`${folder}/${tmpFileName}`);

    const pipeline = fd.createReadStream().pipe(StreamArray.withParser());

    for await (const { value } of pipeline) {
      value.data[Symbol.iterator] = function* () {
        const keys = Object.keys(this);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          yield this[key];
        }
      };

      await finalFilefd.write(Uint8Array.from(value.data), {
        position: value.position,
      });
    }

    await fd.close();

    await rm(`${folder}/${tmpFileName}`);
  }

  await finalFilefd.close();
  logger.info(`Finished make webm file for ${filename}`);
}
