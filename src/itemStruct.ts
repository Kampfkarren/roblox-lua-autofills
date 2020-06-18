import * as vscode from "vscode"
import { getAutocompleteDump } from "./autocompleteDump"

export class ItemStructCompletionProvider implements vscode.CompletionItemProvider {
    public itemStructNames: Promise<vscode.CompletionItem[]>
    public itemStructs: Promise<{ [name: string]: vscode.CompletionItem[] }>

    constructor() {
        this.itemStructs = (async () => {
            const autocompleteDump = await getAutocompleteDump()
            const itemStructs: { [name: string]: vscode.CompletionItem[] } = {}
            for (const itemStruct of autocompleteDump.ItemStruct) {
                itemStructs[itemStruct.name] = [
                    ...itemStruct.properties.filter((property) => property.static).map((property) => {
                        const item = new vscode.CompletionItem(property.name, vscode.CompletionItemKind.Field)
                        item.detail = property.type
                        item.documentation = new vscode.MarkdownString(`${property.description ? property.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/datatype/${itemStruct.name})`)
                        return item
                    }),
                    ...itemStruct.functions.filter((func) => func.static).map((func) => {
                        const params = []
                        for (const param of func.parameters) {
                            const paramText = `${param.name}${param.optional ? "?" : ""}: ${param.type || "unknown"}`
                            params.push(paramText)
                        }

                        const item = new vscode.CompletionItem(
                            func.name,
                            vscode.CompletionItemKind.Function,
                        )
                        item.detail = `(function) ${itemStruct.name}.${func.name}(${params.join(", ")}): ${func.returns.length > 0 ? func.returns.map((ret) => ret.type).join(", ") : "unknown"}`
                        item.documentation = new vscode.MarkdownString(`${func.description ? func.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/datatype/${itemStruct.name})`)
                        return item
                    }),
                ]
            }

            return itemStructs
        })()

        this.itemStructNames = (async () => {
            const autocompleteDump = await getAutocompleteDump()
            return autocompleteDump.ItemStruct.map(
                (itemStruct) => new vscode.CompletionItem(itemStruct.name, vscode.CompletionItemKind.Class),
            )
        })()
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const textSplit = document.lineAt(position.line).text.substr(0, position.character).split(/[^\w\.]+/)
        const text = textSplit[textSplit.length - 1]

        if (text !== undefined) {
            const tokens = text.split(".")
            if (tokens.length === 1) {
                return this.itemStructNames
            } else if (tokens.length === 2) {
                const library = tokens[0]
                const items = (await this.itemStructs)[library]
                return items || []
            }
        }
    }
}
