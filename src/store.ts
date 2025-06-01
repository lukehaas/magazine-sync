import fs from 'fs';
import path from 'path';

const STORE_PATH = path.resolve(__dirname, '../store.json');

export async function getLatestIssueId(key: string): Promise<string | null> {
  try {
    const data = await fs.promises.readFile(STORE_PATH, 'utf-8');
    const store = JSON.parse(data);
    return store[key] || null;
  } catch (error) {
    console.error('Error reading store:', error);
    return null;
  }
}

export async function setLatestIssueId(key: string, value: string): Promise<void> {
  try {
    let store: Record<string, string> = {};
    try {
      const data = await fs.promises.readFile(STORE_PATH, 'utf-8');
      store = JSON.parse(data);
    } catch (error) {
      // If the file doesn't exist or is empty, we start with an empty store
    }
    store[key] = value;
    await fs.promises.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('Error writing to store:', error);
  }
}
