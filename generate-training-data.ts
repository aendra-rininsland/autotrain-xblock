/**
 * @file
 * Pull all blobs from reports in Ozone label service
 * Create training data file
 *
 * (c) 2024 Aendra.
 */

import { AppBskyEmbedImages, BskyAgent } from "@atproto/api";
import * as Papa from "papaparse";
import fs from "fs/promises";
import axios from "axios";

const agent = new BskyAgent({
  service: "https://bsky.social",
});

const LIMIT = 20;

void (async function main() {
  const { data: labels } = Papa.parse<OzoneLabel>(
    await fs.readFile("./labels.csv", "utf-8"),
    {
      header: true,
      dynamicTyping: true,
    }
  );

  await agent.login({
    identifier: process.env.BSKY_HANDLE!,
    password: process.env.BSKY_PASSWORD!,
  });

  const unique = [
    ...new Set(
      labels
        .filter((i) => i && i.val)
        .map((d) => d.val?.replace("-screenshot", ""))
    ),
  ];

  for (const u of unique) {
    await fs.mkdir(`./data/${u}`, { recursive: true });
    await fs.mkdir(`./data/not-${u}`, { recursive: true });
  }

  for (const labelGroup of Array.from(
    { length: Math.ceil(labels.length / LIMIT) },
    (v, i) => labels.slice(i * LIMIT, i * LIMIT + LIMIT)
  )) {
    try {
      const {
        data: { posts },
      } = await agent.api.app.bsky.feed.getPosts({
        uris: labelGroup
          .map((p) => p.uri)
          .filter((i) => i && i.startsWith("at://")),
      });

      for (const post of posts) {
        const { images = [] } = post.embed as AppBskyEmbedImages.View;
        for (const image of images) {
          try {
            const [cid, ext] = image.fullsize.split("/").pop()!.split("@");
            const { data, status } = await axios.get(image.fullsize, {
              responseType: "arraybuffer",
            });

            if (data && status === 200) {
              const filename = `${cid}.${ext}`;

              const postLabels = labels
                .filter((d) => d.uri === post.uri)
                .map((l) => l.val?.replace("-screenshot", ""));

              for (const label of postLabels) {
                await fs.writeFile(
                  `./data/${label.replace("-screenshot", "")}/${filename}`,
                  data
                );
                // console.log(label);
              }

              const notLabels = unique.filter(
                (l) => !postLabels.includes(l.replace("-screenshot", ""))
              );

              console.log(postLabels, notLabels);

              for (const notLabel of notLabels) {
                await fs.writeFile(`./data/not-${notLabel}/${filename}`, data);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
})();

interface OzoneLabel {
  id: number;
  src: string;
  uri: string;
  cid: string;
  val: string;
  neg: boolean;
  cts: Date;
  exp: any;
  sig: string;
  signingKeyId: number;
}
