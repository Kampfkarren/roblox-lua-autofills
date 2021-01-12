import * as vscode from "vscode"
import { AutocompleteFunction, getAutocompleteDump } from "./autocompleteDump"
import { ApiClass, ApiDump, getApiDump, UNCREATABLE_TAGS } from "./dump"

const parameterClassFilter = (objectType: string, constraint: string) => {
    return (klass: ApiClass): boolean => {
        if (objectType === "Instance") {
            if (constraint === "any") {
                return true
            } else if (constraint === "isScriptCreatable") {
                return klass.Tags === undefined || klass.Tags.every(tag => !UNCREATABLE_TAGS.has(tag))
            }
        }

        return false
    }
}

const getFunctionParameters = (func: AutocompleteFunction, apiDump: ApiDump): [ string[], vscode.SnippetString ] => {
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

                paramInsertText = apiDump.Classes
                    .filter(parameterClassFilter(objectType, constraint))
                    .map(klass => klass.Name).sort().join(",")
            }

            if (paramInsertText !== undefined) {
                insertText.value += `"\${${paramIndex + 1}|${paramInsertText}|}"`
            }
        }
    }
    // End parantheses and set the cursor inside or outside the parens depending on param count
    insertText.value += `${params.length > 0 ? `$0)` : `)$0`}`
    return [ params, insertText ]
}

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
                        const [ params, insertText ] = getFunctionParameters(func, apiDump)

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
            const apiDump = await getApiDump()
            return autocompleteDump.ItemStruct.filter(
                itemStruct => itemStruct.functions.filter(
                        func => func.static,
                    ).length > 0 || itemStruct.properties.filter((property) => property.static).length > 0,
            ).map(
                itemStruct => {
                    const completionItem = new vscode.CompletionItem(itemStruct.name, vscode.CompletionItemKind.Class)
                    completionItem.detail = `(struct) ${itemStruct.name}`
                    completionItem.documentation = new vscode.MarkdownString(`[Developer Reference](https://developer.roblox.com/en-us/api-reference/datatype/${itemStruct.name})`)

                    if (itemStruct.name === "Instance") {
                        const func = itemStruct.functions.find(func => func.name === "new")
                        if (func !== undefined) {
                            const [ params, insertText ] = getFunctionParameters(func, apiDump)
                            insertText.value = `${itemStruct.name}.${insertText.value}`
                            completionItem.insertText = insertText
                            completionItem.label = "Instance.new"
                            completionItem.detail = `(function) ${itemStruct.name}.${func.name}(${params.join(", ")}): ${func.returns.length > 0 ? func.returns.map((ret) => ret.type).join(", ") : "unknown"}`
                            completionItem.documentation = new vscode.MarkdownString(`${func.description ? func.description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/datatype/${itemStruct.name})`)
                        }
                    }

                    return completionItem
                },
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
