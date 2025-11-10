import fs from 'node:fs';
import path from 'node:path';
const dataDir = path.join(process.cwd(), 'src', 'data', 'persisted');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
export function resolveDataPath(fileName) {
    return path.join(dataDir, fileName);
}
export function readJsonFile(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            if (raw.trim() === '')
                return fallback;
            return JSON.parse(raw);
        }
    }
    catch (err) {
        console.error(`Failed to read JSON from ${filePath}:`, err);
    }
    return fallback;
}
export function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    catch (err) {
        console.error(`Failed to persist JSON to ${filePath}:`, err);
    }
}
