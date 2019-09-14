import * as cp from "child_process"
import * as os from "os"
import * as path from "path"
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
}

class ShimCompanion implements ICompanion {
	async generateModuleDump(): Promise<ModuleDump | null> {
		return null
	}

	dispose() {}
}

export class Companion implements vscode.Disposable {
	static instance: ICompanion

	constructor(context: vscode.ExtensionContext) {
		if (Companion.instance !== undefined) {
			throw new Error("Companion already initialized")
		}

		let companion: ICompanion

		switch (os.platform()) {
			case "win32":
				companion = new RpcCompanion(context, "companion.exe")
				break
			default:
				companion = new ShimCompanion()
		}

		Companion.instance = companion
	}

	static getInstance(): ICompanion {
		return Companion.instance
	}

	dispose() {
		Companion.getInstance().dispose()
	}
}
