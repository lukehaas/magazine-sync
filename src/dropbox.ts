import { Dropbox } from 'dropbox';
import fs from 'fs';
import path from 'path';

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || '';

export async function upload(filePath: string) {
  const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN, fetch: fetch.bind(globalThis) });
  const fileName = path.basename(filePath);
  const fileContent = await fs.promises.readFile(filePath);
  await dbx.filesUpload({
    path: '/' + fileName,
    contents: fileContent,
    mode: { '.tag': 'overwrite' },
  });
  console.log('Uploaded to Dropbox:', fileName);
}
