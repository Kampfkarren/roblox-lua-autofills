import * as vscode from "vscode"
import { getAutocompleteDump } from "./autocompleteDump"

export class LuaLibraryCompletionProvider implements vscode.CompletionItemProvider {
    public luaLibraryNames: Promise<vscode.CompletionItem[]>
    public luaLibrary: Promise<{ [name: string]: vscode.CompletionItem[] }>

    constructor() {
        this.luaLibrary = (async () => {
            const autocompleteDump = await getAutocompleteDump()
            const luaLibrary: { [name: string]: vscode.CompletionItem[] } = {}
            for (const library of autocompleteDump.LuaLibrary) {
                luaLibrary[library.name] = [
                    ...library.properties.map((property) => {
                        const item = new vscode.CompletionItem(property.name, vscode.CompletionItemKind.Field)
                        item.detail = `(property) ${library.name}.${property.name}: ${property.type}`
                        item.documentation = new vscode.MarkdownString(`${property.description ? property.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/lua-docs/${library.name})`)
                        return item
                    }),
                    ...library.functions.map((func) => {
                        const params = []
                        for (const param of func.parameters) {
                            const paramText = `${param.name}${param.optional ? "?" : ""}: ${param.type || "unknown"}`
                            params.push(paramText)
                        }

                        const item = new vscode.CompletionItem(
                            func.name,
                            vscode.CompletionItemKind.Function,
                        )
                        item.detail = `(function) ${library.name}.${func.name}(${params.join(", ")}): ${func.returns.length > 0 ? func.returns.map((ret) => ret.type).join(", ") : "unknown"}`
                        item.documentation = new vscode.MarkdownString(`${func.description ? func.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/lua-docs/${library.name})`)
                        return item
                    }),
                ]
            }

            return luaLibrary
        })()

        this.luaLibraryNames = (async () => {
            const autocompleteDump = await getAutocompleteDump()
            return autocompleteDump.LuaLibrary.map(
                (library) => new vscode.CompletionItem(library.name, vscode.CompletionItemKind.Module),
            )
        })()
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const textSplit = document.lineAt(position.line).text.substr(0, position.character).split(/[^\w\.]+/)
        const text = textSplit[textSplit.length - 1]

        if (text !== undefined) {
            const tokens = text.split(".")
            if (tokens.length === 1) {
                return this.luaLibraryNames
            } else if (tokens.length === 2) {
                const library = tokens[0]
                const items = (await this.luaLibrary)[library]
                return items || []
            }
        }
    }
}
