// Service member auto complete

import * as vscode from "vscode"
import { ApiMember, getApiDump } from "./dump"

const UNSCRIPTABLE_TAGS: Set<string> = new Set([
    "Deprecated",
    "Hidden",
    "NotBrowsable",
    "NotScriptable",
])

const IMPORT_PATTERN = /^local \w+ = game:GetService\("\w+"\)\s*$/

export class ServiceCompletionProvider implements vscode.CompletionItemProvider {
    serviceMembers: Promise<Map<string, Array<ApiMember>>>

    constructor() {
        this.serviceMembers = getApiDump().then(dump => {
            const output = new Map()

            for (const klass of dump.Classes) {
                if (klass.Tags !== undefined && klass.Tags.includes("Service")) {
                    output.set(klass.Name, klass.Members.filter((member) => {
                        const tags = member.Tags
                        if (tags !== undefined) {
                            for (const tag of tags) {
                                if (UNSCRIPTABLE_TAGS.has(tag)) {
                                    return false
                                }
                            }
                        }

                        return true
                    }))
                }
            }

            return output
        })
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const serviceMatch = document.lineAt(position.line).text.substr(0, position.character).match(/(\w+)([:.]?)\w*$/)

        if (serviceMatch !== null) {
            const serviceName = serviceMatch[1]
            const operator = serviceMatch[2]

            const serviceMembers = (await this.serviceMembers).get(serviceName)

            if (serviceMembers !== undefined) {
                const documentText = document.getText()

                if (!documentText.match(new RegExp(`^local ${serviceName} = `))) {
                    const insertText = `local ${serviceName} = game:GetService("${serviceName}")\n`
                    const lines = documentText.split(/\n\r?/)

                    const firstImport = lines.findIndex(line => line.match(IMPORT_PATTERN))
                    let lineNumber = Math.max(firstImport, 0)

                    while (lineNumber < lines.length) {
                        if (
                            !lines[lineNumber].match(IMPORT_PATTERN)
                            || lines[lineNumber] > insertText
                        ) {
                            break
                        }
                        lineNumber++
                    }

                    const item = new vscode.CompletionItem(
                        serviceName,
                        vscode.CompletionItemKind.Class,
                    )
                    item.additionalTextEdits = [
                        vscode.TextEdit.insert(
                            new vscode.Position(lineNumber, 0),
                            insertText + (firstImport === -1 ? "\n" : ""),
                        )
                    ]
                    item.detail = "Auto-import service"
                    item.preselect = true
                    item.insertText = operator ? "" : serviceName

                    return [item]
                }

                const completionItems = []

                for (const member of serviceMembers) {
                    if (member.Security !== "None") {
                        continue
                    }

                    if (operator === ":") {
                        if (member.MemberType === "Function") {
                            const params = []

                            for (const param of member.Parameters) {
                                let paramText = param.Name

                                if (param.Default !== undefined) {
                                    paramText += ` = ${param.Default}`
                                }

                                params.push(paramText)
                            }

                            const completionItem = new vscode.CompletionItem(
                                `${member.Name}(${params.join(", ")})`,
                                vscode.CompletionItemKind.Method,
                            )

                            completionItem.insertText = new vscode.SnippetString(`${member.Name}($0)`)

                            completionItems.push(completionItem)
                        }
                    } else {
                        switch (member.MemberType) {
                            case "Callback":
                                completionItems.push(new vscode.CompletionItem(
                                    member.Name,
                                    vscode.CompletionItemKind.Constructor,
                                ))
                                break

                            case "Event":
                                completionItems.push(new vscode.CompletionItem(
                                    member.Name,
                                    vscode.CompletionItemKind.Event,
                                ))
                                break

                            case "Property":
                                completionItems.push(new vscode.CompletionItem(
                                    member.Name,
                                    vscode.CompletionItemKind.Field,
                                ))
                                break
                        }
                    }
                }

                return completionItems
            }
        }

        return []
    }
}
