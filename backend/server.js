import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildMeta, calculateInCombatPanel, calculateOutOfCombatPanel, loadCalculatorContext } from "./calculator.js"
import {
    deleteUserDriveDisc,
    importScannerExportToStore,
    loadUserDriveDiscStore,
    upsertUserDriveDisc,
} from "./driveDiscInventory.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const dataDir = path.join(rootDir, "data")
const frontendDir = path.join(rootDir, "frontend")
const port = Number(process.env.PORT || 8787)

const catalog = await loadCalculatorContext(rootDir)

function sendJson(res, statusCode, payload) {
    const text = JSON.stringify(payload, null, 2)
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end(text)
}

function sendText(res, statusCode, text, contentType) {
    res.writeHead(statusCode, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end(text)
}

async function readBody(req) {
    const chunks = []
    for await (const chunk of req) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString("utf8")
}

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8"
        case ".js":
            return "text/javascript; charset=utf-8"
        case ".css":
            return "text/css; charset=utf-8"
        case ".json":
            return "application/json; charset=utf-8"
        case ".svg":
            return "image/svg+xml"
        case ".png":
            return "image/png"
        case ".jpg":
        case ".jpeg":
            return "image/jpeg"
        case ".webp":
            return "image/webp"
        default:
            return "application/octet-stream"
    }
}

async function serveStatic(res, pathname) {
    const fileName = pathname === "/" ? "index.html" : pathname.replace(/^\//, "")
    const absPath = path.resolve(frontendDir, fileName)
    const relativePath = path.relative(frontendDir, absPath)
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        sendText(res, 403, "Forbidden", "text/plain; charset=utf-8")
        return
    }

    if (!existsSync(absPath)) {
        const indexPath = path.join(frontendDir, "index.html")
        if (!existsSync(indexPath)) {
            sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
            return
        }

        const html = await readFile(indexPath, "utf8")
        sendText(res, 200, html, "text/html; charset=utf-8")
        return
    }

    res.writeHead(200, {
        "Content-Type": contentType(absPath),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    createReadStream(absPath).pipe(res)
}

async function routeApi(req, res, pathname) {
    if (req.method === "OPTIONS") {
        sendText(res, 204, "", "text/plain; charset=utf-8")
        return
    }

    if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, {
            ok: true,
            service: "zzz_calculator",
        })
        return
    }

    if (req.method === "GET" && pathname === "/api/meta") {
        sendJson(res, 200, buildMeta(catalog))
        return
    }

    if (req.method === "GET" && pathname === "/api/example/out-of-combat") {
        sendJson(res, 200, catalog.example)
        return
    }

    if (req.method === "GET" && pathname === "/api/example/ye-shunguang") {
        sendJson(res, 200, catalog.examples.yeShunguang)
        return
    }

    if (req.method === "POST" && pathname === "/api/calculate/out-of-combat") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = calculateOutOfCombatPanel(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/calculate/in-combat") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = calculateInCombatPanel(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "GET" && pathname === "/api/user-drive-discs") {
        sendJson(res, 200, await loadUserDriveDiscStore(dataDir))
        return
    }

    if (req.method === "POST" && pathname === "/api/user-drive-discs/import/zzz-scanner") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "[]")
            const embeddedData = Array.isArray(input)
                ? input
                : input.items ?? input.driveDiscs ?? input.drive_discs ?? input.discs ?? input.data ?? input.export
            const sourceData = embeddedData ?? (
                input.sourcePath
                    ? JSON.parse(await readFile(input.sourcePath, "utf8"))
                    : input
            )
            const store = await importScannerExportToStore(dataDir, sourceData, {
                ownerId: input.ownerId ?? "default",
                sourcePath: input.sourcePath ?? null,
            })
            sendJson(res, 200, {
                ok: true,
                store,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/user-drive-discs") {
        try {
            const body = await readBody(req)
            const driveDisc = JSON.parse(body || "{}")
            const store = await upsertUserDriveDisc(dataDir, driveDisc)
            sendJson(res, 200, {
                ok: true,
                store,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (pathname.startsWith("/api/user-drive-discs/")) {
        const id = decodeURIComponent(pathname.slice("/api/user-drive-discs/".length))
        if (!id) {
            sendJson(res, 400, {
                ok: false,
                error: "Drive disc id is required.",
            })
            return
        }

        if (req.method === "PUT") {
            try {
                const body = await readBody(req)
                const driveDisc = {
                    ...JSON.parse(body || "{}"),
                    id,
                }
                const store = await upsertUserDriveDisc(dataDir, driveDisc)
                sendJson(res, 200, {
                    ok: true,
                    store,
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }

        if (req.method === "DELETE") {
            const result = await deleteUserDriveDisc(dataDir, id)
            sendJson(res, 200, {
                ok: true,
                deleted: result.deleted,
                store: result.store,
            })
            return
        }
    }

    sendJson(res, 404, {
        ok: false,
        error: "Not found",
    })
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    const pathname = decodeURIComponent(url.pathname)

    try {
        if (pathname.startsWith("/api/")) {
            await routeApi(req, res, pathname)
            return
        }

        await serveStatic(res, pathname)
    } catch (error) {
        sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        })
    }
})

server.listen(port, () => {
    console.log(`ZZZ calculator running at http://localhost:${port}`)
})
