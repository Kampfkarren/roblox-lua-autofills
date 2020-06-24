import * as vscode from "vscode"
import { getAutocompleteDump } from "./autocompleteDump"
import { getApiDump, UNCREATABLE_TAGS } from "./dump"

export class ItemStructCompletionProvider implements vscode.CompletionItemProvider {
    itemStructNames: Promise<vscode.CompletionItem[]>
    itemStructs: Promise<{ [name: string]: vscode.CompletionItem[] }>

    constructor() {
        this.itemStructs = (async () => {
            const autocompleteDump = await getAutocompleteDump()
            const apiDump = await getApiDump()
            const itemStructs: { [name: string]: vscode.CompletionItem[] } = {}
            for (const itemStruct of autocompleteDump.ItemStruct) {
                itemStructs[itemStruct.name] = [
                    ...itemStruct.properties.filter(property => property.static).map(property => {
                        const item = new vscode.CompletionItem(property.name, vscode.CompletionItemKind.Field)
                        item.detail = `(property) ${itemStruct.name}.${property.name}: ${property.type}`
                        item.documentation = new vscode.MarkdownString(`${property.description ? property.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/datatype/${itemStruct.name})`)
                        return item
                    }),
                    ...itemStruct.functions.filter(func => func.static).map(func => {
                        const insertText = new vscode.SnippetString(`${func.name}(`)

                        const params = []
                        for (const paramIndex in func.parameters) {
                            if (func.parameters[paramIndex] !== undefined) {
                                const param = func.parameters[paramIndex]
                                const paramText = `${param.name}${param.optional ? "?" : ""}: ${param.type || "unknown"}`
                                params.push(paramText)

                                // Create a snippet if the parameters are definable (eg. Instance.new())
                                let paramInsertText
                                if (param.constraint !== undefined) {
                                    const constraintSplit = param.constraint.split(":")
                                    const objectType = constraintSplit[0]
                                    const constraint = constraintSplit[1] || "any"

                                    paramInsertText = apiDump.Classes.filter(klass => {
                                        if (objectType === "Instance") {
                                            if (constraint === "any") {
                                                return true
                                            } else if (constraint === "isScriptCreatable") {
                                                const tags = klass.Tags
                                                if (tags !== undefined) {
                                                    for (const tag of tags) {
                                                        if (UNCREATABLE_TAGS.has(tag)) {
                                                            return false
                                                        }
                                                    }
                                                }
                                                return true
                                            }
                                        }
                                        return false
                                    }).map(klass => klass.Name).sort().join(",")
                                }

                                if (paramInsertText !== undefined) {
                                    insertText.value += `"\${${paramIndex + 1}|${paramInsertText}|}"`
                                }
                            }
                        }
                        // End parantheses and set the cursor inside or outside the parens depending on param count
                        insertText.value += `${params.length > 0 ? `$0)` : `)$0`}`

                        const item = new vscode.CompletionItem(
                            func.name,
                            vscode.CompletionItemKind.Function,
                        )
                        item.insertText = insertText
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
            return autocompleteDump.ItemStruct.filter(
                itemStruct => {
                    return itemStruct.functions.filter(
                        func => func.static,
                    ).length > 0 || itemStruct.properties.filter((property) => property.static).length > 0
                },
            ).map(
                itemStruct => new vscode.CompletionItem(itemStruct.name, vscode.CompletionItemKind.Class),
            )
        })()
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
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
