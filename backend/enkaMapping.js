import { readFile } from "node:fs/promises"
import path from "node:path"

export const ENKA_RUNTIME_MAPPING_FILE = "enka_zzz_mapping.runtime.json"

export async function loadEnkaMappingSnapshot(backendDir, dataDir) {
    const runtimePath = path.join(backendDir, ENKA_RUNTIME_MAPPING_FILE)
    try {
        return JSON.parse(await readFile(runtimePath, "utf8"))
    } catch (error) {
        if (error?.code !== "ENOENT") throw error
    }
    return JSON.parse(await readFile(path.join(dataDir, "enka_zzz_mapping.json"), "utf8"))
}
