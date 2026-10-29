import { program } from "commander";
import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import * as fsp from "node:fs/promises";
import * as slurmjs from "slurmjs";

const VERSION = "1.0.0";

program.version(VERSION);

async function detectEnv() {
    const slurmVersion = await slurmjs.getSlurmVersion().catch(() => {
        console.error(`[agent] slurm not installed`);
        return null;
    });
    return {
        hostname: os.hostname(),
        username: os.userInfo().username,
        version: VERSION,
        node: process.version,
        slurmVersion,
    };
}

async function connect(url, options) {
    const password = options.password || randomUUID();
    const id = options.name || os.hostname();

    // Only the id is announced at registration; environment info is served by backend:info after auth
    const info = await detectEnv();

    console.log(`[agent] connecting to gateway ${url}`);
    console.log(`[agent] identity ${id}`);
    console.log(`[agent] access key ${password}`);

    if (info.username == "root") {
        console.warn(`[agent] running as root, agent will close automatically in 10 minutes`);
        setTimeout(() => {
            console.log(`[agent] closing agent as root`);
            process.exit(0);
        }, 10 * 60 * 1000);
    }

    const socket = io(url, {
        path: "/socket.io/",
        transports: ["polling", "websocket"],
        auth: { role: "backend" },
        query: { role: "backend" },
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
        socket.emit("backend:register", { id }, (ack) => {
            if (ack?.ok) {
                console.log(`[agent] uplink established (${socket.id})`);
            } else {
                console.error(
                    `[agent] register rejected: ${ack?.error || "unknown"}`,
                );
            }
        });
    });

    socket.on("session:enter", (payload, ack) => {
        if (payload?.password !== password) {
            console.warn(
                `[agent] auth rejected for browser ${payload?.browserId || "?"}`,
            );
            ack?.({ ok: false, error: "invalid access key" });
            return;
        }
        console.log(
            `[agent] session enter from browser ${payload.browserId || "?"}`,
        );
        ack?.({ ok: true });
    });

    async function jobOutput(filePath) {
        const maxOutputBytes = 256 * 1024;
        let handle;
        try {
            handle = await fsp.open(filePath);
            const { size } = await handle.stat();
            const start = Math.max(0, size - maxOutputBytes);
            const buf = Buffer.alloc(size - start);
            if (buf.length) await handle.read(buf, 0, buf.length, start);
            return { path: filePath, size, truncated: start > 0, content: buf.toString("utf-8") };
        } catch (err) {
            throw new Error(`read failed: ${err.message}`, { cause: err });
        } finally {
            await handle?.close();
        }
    }

    const onSlurm = (event, run) =>
        socket.on(event, async (payload, ack) => {
            try {
                ack?.({ ok: true, data: await run(payload) });
            } catch (err) {
                ack?.({ ok: false, error: err.message });
            }
        });

    // sbatch rejects CRLF, so line endings are normalized before the script is written
    async function submitJob({ fileName, content }) {
        const name = String(fileName || "").trim();
        if (!name) throw new Error("file path is required");
        const target = path.resolve(process.cwd(), name);
        const script = String(content ?? "").replace(/\r\n?/g, "\n");
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.writeFile(target, script, { mode: 0o644, flag: "wx" });
        return { jobId: await slurmjs.submitSlurmJob(target), path: target };
    }

    onSlurm("slurm:list_queue", () => slurmjs.getSlurmQueueInfo());
    onSlurm("slurm:list_history", () =>
        slurmjs.getSlurmJobInfo(),
    );
    onSlurm("slurm:list_cluster", () => slurmjs.getSlurmClusterInfo());
    onSlurm("slurm:list_nodes", () => slurmjs.getSlurmNodeInfo());
    onSlurm("slurm:list_accounts", () => slurmjs.getSlurmAccountInfo());
    onSlurm("slurm:job_stat", (p) => slurmjs.getSlurmJobStat(p.jobId, p.target));
    onSlurm("slurm:job_output", (p) => jobOutput(p.path));
    onSlurm("slurm:submit_job", (p) => submitJob(p));
    onSlurm("slurm:cancel_job", (p) => slurmjs.cancelSlurmJob(String(p.jobId)));
    onSlurm("slurm:hold_job", (p) => slurmjs.holdSlurmJob(String(p.jobId)));
    onSlurm("slurm:release_job", (p) => slurmjs.releaseSlurmJob(String(p.jobId)));
    onSlurm("slurm:update_node", (p) =>
        slurmjs.updateSlurmNodeState(p.nodeName, p.state),
    );
    onSlurm("slurm:add_account", (p) =>
        slurmjs.addSlurmAccount(p.name, p.parent || "", p.description || ""),
    );
    onSlurm("slurm:modify_account", (p) => slurmjs.modifySlurmAccount(p.where, p.set));
    onSlurm("slurm:delete_account", (p) => slurmjs.deleteSlurmAccount(p.name));

    onSlurm("backend:info", () => info);

    socket.on("disconnect", (reason) => {
        console.log(`[agent] disconnected (${reason}) — waiting to reconnect`);
    });

    socket.on("connect_error", (err) => {
        console.error(`[agent] connect error: ${err.message}`);
        console.error(
            `[agent] hint: ensure frontend is running, try: bun server.js start http://localhost:3000`,
        );
    });
}

program
    .command("start")
    .description("Connect this agent to the Orbital frontend gateway")
    .argument("<url>", "Frontend gateway URL, e.g. http://localhost:3000")
    .option(
        "-p, --password <password>",
        "access key for this backend (default: random)",
    )
    .option("-n, --name <name>", "backend display name (default: hostname)")
    .action(connect);

program.parse(process.argv);
