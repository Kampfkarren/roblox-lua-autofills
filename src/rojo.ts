import * as vscode from "vscode"
import { TextDecoder } from "util"

const INIT_FILE = /(init(\.server|\.client)?\.lua|init\.meta\.json)/

// Don't change this to *.project.json
// While that makes more sense, vscode didn't fire changed/created events for them
// Instead, its location is explicitly checked
const PROJECT_FILES_GLOB = "**/*.project.json"

const SELECTOR = { scheme: "file", language: "lua" }

interface InstanceDescription {
	$className?: string,
	$path?: string,
	children: Map<string, InstanceDescription>,
}

interface Project {
	tree: InstanceDescription,
}

function parseInstanceDescription(instanceDescription: { [key: string]: unknown }): InstanceDescription | null {
	let description: InstanceDescription = {
		children: new Map(),
	}

	if (typeof instanceDescription.$className === "string") {
		description.$className = instanceDescription.$className
	}

	if (typeof instanceDescription.$path === "string") {
		description.$path = instanceDescription.$path
	}

	for (let name in instanceDescription) {
		if (!name.startsWith("$")) {
			const child = instanceDescription[name]
			if (typeof child === "object") {
				let childDescription = parseInstanceDescription(child as { [key: string]: unknown })
				if (childDescription !== null) {
					description.children.set(name, childDescription)
				}
			}
		}
	}

	if (description.children.size === 0 && description.$className === null && description.$path === null) {
		return null
	}

	return description
}

function parseProject(projectFile: string): Project | null {
	let project

	try {
		project = JSON.parse(projectFile)
	} catch (SyntaxError) {
		return null
	}

	if (project === null) {
		return null
	}

	switch (typeof project) {
		case "boolean":
		case "number":
		case "string":
			return null
	}

	if (project.tree === undefined) {
		return null
	}

	const tree = parseInstanceDescription(project.tree)
	return tree ? { tree } : null
}

interface InstanceMeta {
	components: Array<string>,
	path: string,
	uris: Set<string>,
}

export class RojoHandler {
	completionItemProvider: vscode.Disposable
	fileWatcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/*.lua", false, true)
	instances: Map<vscode.Uri, Array<InstanceMeta>> = new Map()
	projects: Map<vscode.Uri, Project> = new Map()
	projectWatcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(PROJECT_FILES_GLOB)

	constructor() {
		this.fileWatcher.onDidCreate(uri => this.checkCreatedSource(uri))
		this.fileWatcher.onDidDelete(uri => this.checkDeletedSource(uri))

		this.projectWatcher.onDidCreate(uri => this.checkForProject(uri))
		this.projectWatcher.onDidChange(uri => this.checkForProject(uri))
		this.projectWatcher.onDidDelete(uri => this.projects.delete(uri))

		this.refreshFilesCache()

		this.completionItemProvider = vscode.languages.registerCompletionItemProvider(SELECTOR, {
			provideCompletionItems: (document, position) => {
				const line = document.lineAt(position.line).text.substr(0, position.character)
				const requireMatch = line.match(/require\(([A-Za-z]+)((?:\.[\w]*)+)/)
				const children: Map<string, vscode.CompletionItemKind> = new Map()

				if (requireMatch !== null) {
					const service = requireMatch[1]
					const path = [service, ...requireMatch[2].split(".").slice(1, -1)]

					for (const instances of this.instances.values()) {
						nextInstance: for (const instance of instances) {
							for (const [index, component] of instance.components.entries()) {
								if (component !== path[index]) {
									if (index === path.length) {
										children.set(instance.components[path.length], vscode.CompletionItemKind.Folder)
									}

									// The thing they're typing starts with a different base than the instance
									continue nextInstance
								}
							}

							// The initial paths match up with this instance

							for (const uri of instance.uris) {
								let relativePath = uri.substr(instance.path.length + 1)

								const exclude = path.slice(instance.components.length).join("/")

								if (exclude.length > 0) {
									if (relativePath.startsWith(exclude)) {
										relativePath = relativePath.slice(exclude.length + 1)
									} else {
										continue
									}
								}

								const folderMatch = relativePath.match(/^([^\/]+)\/(.*)/)
								if (folderMatch !== null) {
									// This is something inside a folder
									if (folderMatch[2].match(INIT_FILE)) {
										// The file is an init script, so this is actually a module
										children.set(folderMatch[1], vscode.CompletionItemKind.Module)
									} else {
										// This is a file inside a folder
										// If we haven't already established this is a file inside a *module*
										// Then give it a folder icon
										if (!children.has(folderMatch[1])) {
											children.set(folderMatch[1], vscode.CompletionItemKind.Folder)
										}
									}
								} else {
									if (relativePath.match(INIT_FILE) === null) {
										// We don't want to suggest `.init`
										const withoutExtension = relativePath.split(".").slice(0, -1).join(".")

										if (relativePath.endsWith(".lua")) {
											if (!withoutExtension.endsWith(".server")
												&& !withoutExtension.endsWith(".client")
											) {
												children.set(withoutExtension, vscode.CompletionItemKind.Module)
											}
										} else {
											children.set(withoutExtension, vscode.CompletionItemKind.File)
										}
									}
								}
							}
						}
					}
				}

				const completion = []

				for (const [name, kind] of children.entries()) {
					const completionItem = new vscode.CompletionItem(name, kind)
					// TODO: Is it possible if it's a folder to append a dot
					// ...and have it start the next autocomplete?
					completion.push(completionItem)
				}

				return completion
			}
		}, ".")
	}

	async checkCreatedSource(uri: vscode.Uri) {
		for (const instances of this.instances.values()) {
			for (const instance of instances) {
				// normalize the path
				const normalPath = vscode.workspace.asRelativePath(uri)

				if (normalPath.startsWith(instance.path)) {
					instance.uris.add(normalPath)
				}
			}
		}
	}

	async checkDeletedSource(uri: vscode.Uri) {
		for (const instances of this.instances.values()) {
			for (const instance of instances) {
				// normalize the path
				const normalPath = vscode.workspace.asRelativePath(uri)

				if (normalPath.startsWith(instance.path)) {
					instance.uris.delete(normalPath)
				}
			}
		}
	}

	async checkForProject(uri: vscode.Uri) {
		if (vscode.workspace.asRelativePath(uri).match("/")) {
			// Project is not in the root, call it off
			return
		}

		this.instances.delete(uri)
		this.projects.delete(uri)

		const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
		const project = parseProject(contents)

		if (project !== null) {
			if (project.tree.$className === "DataModel") {
				this.projects.set(uri, project)

				this.populateInstances(project.tree).then(metas => {
					this.instances.set(uri, metas)
				})
			}
		}
	}

	dispose() {
		this.completionItemProvider.dispose()
		this.fileWatcher.dispose()
		this.projectWatcher.dispose()
	}

	async populateInstances(
		instanceDescription: InstanceDescription,
		base: Array<string> = []
	): Promise<Array<InstanceMeta>> {
		const metas: Array<InstanceMeta> = new Array()
		const walking: Array<Thenable<void>> = new Array()

		for (const [name, instance] of instanceDescription.children.entries()) {
			if (instance.$path !== undefined) {
				const meta = {
					components: base.concat(name),
					uris: new Set<string>(),
				}

				const path = instance.$path

				walking.push(vscode.workspace.findFiles(`${path}/**`).then(files => {
					for (const file of files) {
						meta.uris.add(vscode.workspace.asRelativePath(file))
					}
				}))

				metas.push({
					path,
					...meta
				})
			}

			walking.push(this.populateInstances(instance, base.concat(name)).then(array => {
				metas.push(...array.values())
			}))
		}

		await Promise.all(walking)

		return metas
	}

	async refreshFilesCache() {
		const files = await vscode.workspace.findFiles(PROJECT_FILES_GLOB)
		for (const file of files) {
			this.checkForProject(file)
		}
	}
}
