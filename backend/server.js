import { program } from "commander";
import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";
import os from "node:os";
import * as fsp from "node:fs/promises";
import * as slurmjs from "slurmjs";

const VERSION = "1.0.0";

program.version(VERSION);

async function detectEnv() {
    let slurmInstalled = false;
    try {
        await slurmjs.getSlurmVersion();
        slurmInstalled = true;
    } catch {
        console.error("[agent] slurm not installed");
    }
    const isRoot =
        typeof process.getuid === "function" && process.getuid() === 0;
    return { slurmInstalled, isRoot };
}

async function connect(url, options) {
    const password = options.password || randomUUID();
    const meta = {
        id: options.name || os.hostname(),
        hostname: os.hostname(),
        username: os.userInfo().username,
        version: VERSION,
        node: process.version,
        ...(await detectEnv()),
    };

    console.log(`[agent] connecting to gateway ${url}`);
    console.log(`[agent] identity ${meta.id}`);
    console.log(
        `[agent] slurm installed: ${meta.slurmInstalled}, root: ${meta.isRoot}`,
    );
    console.log(`[agent] access key ${password}`);

    const socket = io(url, {
        path: "/socket.io/",
        transports: ["polling", "websocket"],
        auth: { role: "backend" },
        query: { role: "backend" },
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionAttempts: Infinity,
    });

    socket.on("connect", async () => {
        Object.assign(meta, await detectEnv());
        socket.emit("backend:register", meta, (ack) => {
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
        ack?.({ ok: true, backend: meta });
    });

    async function jobOutput(path) {
        const maxOutputBytes = 256 * 1024;
        let handle;
        try {
            handle = await fsp.open(path);
            const { size } = await handle.stat();
            const start = Math.max(0, size - maxOutputBytes);
            const buf = Buffer.alloc(size - start);
            if (buf.length) await handle.read(buf, 0, buf.length, start);
            return { path, size, truncated: start > 0, content: buf.toString("utf-8") };
        } catch (err) {
            throw new Error(`读取失败：${err.message}`, { cause: err });
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

    onSlurm("slurm:version", () => slurmjs.getSlurmVersion());
    onSlurm("slurm:list_queue", () => slurmjs.getSlurmQueueInfo());
    onSlurm("slurm:list_history", () =>
        slurmjs.getSlurmJobInfo(),
    );
    onSlurm("slurm:list_cluster", () => slurmjs.getSlurmClusterInfo());
    onSlurm("slurm:list_nodes", () => slurmjs.getSlurmNodeInfo());
    onSlurm("slurm:list_accounts", () => slurmjs.getSlurmAccountInfo());
    onSlurm("slurm:job_stat", (p) => slurmjs.getSlurmJobStat(p.jobId, p.target));
    onSlurm("slurm:job_output", (p) => jobOutput(p.path));
    onSlurm("slurm:submit_job", (p) => slurmjs.submitSlurmJob(p.jobScript));
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
