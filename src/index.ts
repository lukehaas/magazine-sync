import 'dotenv/config';
import fs from 'fs';

import { upload } from './dropbox';
import { downloadMagazineFromPressReader, downloadMagazineFromRaspberryPi } from './scraper';

type Magazine = {
  name: string;
  source: 'PressReader' | 'raspberrypi';
  type: 'magazine' | 'newspaper';
};

async function getFile({ name, source, type }: Magazine): Promise<string | null> {
  switch (source) {
    case 'PressReader':
      return downloadMagazineFromPressReader(name, type);
    case 'raspberrypi':
      return downloadMagazineFromRaspberryPi(name);
    default:
      console.error(`Unknown source: ${source}`);
      return null;
  }
}

const magazines: Magazine[] = [
  // { name: 'the-economist-uk', source: 'PressReader', type: 'magazine' },
  // { name: 'new-scientist', source: 'PressReader'},
  { name: 'the-wall-street-journal', source: 'PressReader', type: 'newspaper' },
  // { name: 'forbes', source: 'PressReader', type: 'magazine' },
  //{ name: 'raspberry-pi', source: 'raspberrypi', type: 'magazine' },
];

(async () => {
  for (const magazine of magazines) {
    const { name, source, type } = magazine;
    console.log(`Processing magazine: ${name} from source: ${source}`);

    const filePath = await getFile({ name, source, type });
    if (!filePath) {
      console.error(`Failed to download magazine: ${name}`);
      continue;
    }

    if (filePath) {
      await upload(filePath);
      try {
        await fs.promises.unlink(filePath);
        console.log(`Deleted file after upload: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete file: ${filePath}`, err);
      }
    }
  }
})();
