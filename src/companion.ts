import * as crypto from "crypto"
import * as cp from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { promisify } from "util"
import * as vscode from "vscode"

export enum MemberType {
    Function = "Function",
    Method = "Method",
    Value = "Value",
}

export type ModuleDump = { [key: string]: MemberType }

class RpcHandler {
    childProcess: cp.ChildProcess
    id: number = 0
    waitingOn: Map<number, { resolve: (input: any) => void, reject: (code: number) => void }> = new Map()

    constructor(childProcess: cp.ChildProcess) {
        this.childProcess = childProcess

        this.childProcess.stdin.setDefaultEncoding("utf8")

        this.childProcess.stdout.on("data", data => {
            for (const line of data.toString().split("\n")) {
                if (line.length === 0) {
                    continue
                }

                const response: {
                    error?: { code: number },
                    id: number,
                    result?: any,
                } = JSON.parse(line)

                const waiting = this.waitingOn.get(response.id)

                if (waiting !== undefined) {
                    if (response.result === undefined) {
                        waiting.reject(response.error!.code)
                    } else {
                        waiting.resolve(response.result!)
                    }

                    this.waitingOn.delete(response.id)
                }
            }
        })
    }

    sendRequest<P, R>(method: string, ...params: P[]): Promise<R> {
        const id = this.id++

        return new Promise((resolve, reject) => {
            this.waitingOn.set(id, { resolve, reject })

            this.childProcess.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                method,
                id,
                params,
            }))

            this.childProcess.stdin.write("\n")
        })
    }
}

interface ICompanion extends vscode.Disposable {
    generateModuleDump(code: string): Promise<ModuleDump | null>
}

class RpcCompanion implements ICompanion {
    childProcess: cp.ChildProcess
    rpcHandler: RpcHandler

    constructor(context: vscode.ExtensionContext, program: string) {
        this.childProcess = cp.spawn(context.asAbsolutePath(path.join("bin", program)))
        this.rpcHandler = new RpcHandler(this.childProcess)
    }

    dispose() {
        this.childProcess.kill()
        delete Companion.instance
    }

    async generateModuleDump(code: string): Promise<ModuleDump | null> {
        return await this.rpcHandler.sendRequest("generate_module_dump", code)
    }

    static async attemptCreate(context: vscode.ExtensionContext, program: string): Promise<RpcCompanion | ShimCompanion> {
        const stat = promisify(fs.stat)
        const app = context.asAbsolutePath(path.join("bin", program))

        const readFile = promisify(fs.readFile)

        const pem = context.asAbsolutePath(path.join("bin", "public.pem"))
        const sig = context.asAbsolutePath(path.join("bin", `${program}.sig`))

        await Promise.all([
            stat(app).catch(() => Promise.resolve("Companion does not exist, you need to compile it!")),
            stat(pem).catch(() => Promise.resolve("Public key for companion does not exist!")),
            stat(sig).catch(() => Promise.resolve("Companion signature does not exist!")),
        ]).catch((error: string) => {
            vscode.window.showWarningMessage(`roblox-lua-autofills: ${error}`)
            return new ShimCompanion()
        })

        const verify = crypto.createVerify("SHA256")
        verify.write(await readFile(app))
        verify.end()

        const [pemContents, sigContents] = await Promise.all([
            readFile(pem),
            readFile(sig),
        ])

        if (verify.verify(pemContents, sigContents)) {
            return new RpcCompanion(context, program)
        } else {
            vscode.window.showWarningMessage("roblox-lua-autofills: Signature verification of companion failed!")
            return new ShimCompanion()
        }
    }
}

class ShimCompanion implements ICompanion {
    async generateModuleDump(): Promise<ModuleDump | null> {
        return null
    }

    dispose() {}
}

export class Companion implements vscode.Disposable {
    static instance: Promise<ICompanion>

    constructor(context: vscode.ExtensionContext) {
        if (Companion.instance !== undefined) {
            throw new Error("Companion already initialized")
        }

        let companion: Promise<ICompanion>

        switch (os.platform()) {
            case "win32":
                companion = RpcCompanion.attemptCreate(context, "companion.exe")
                break
            case "darwin":
                companion = RpcCompanion.attemptCreate(context, "companion-osx")
                break
            default:
                companion = Promise.resolve(new ShimCompanion())
        }

        Companion.instance = companion
    }

    static getInstance(): Promise<ICompanion> {
        return Companion.instance
    }

    dispose() {
        Companion.getInstance().then(x => x.dispose)
    }
}
