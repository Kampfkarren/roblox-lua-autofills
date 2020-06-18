// Service member auto complete

import * as vscode from "vscode"
import { ApiClass, getApiDump } from "./dump"

const UNSCRIPTABLE_TAGS: Set<string> = new Set([
    "Deprecated",
    "Hidden",
    "NotBrowsable",
    "NotScriptable",
])

const IMPORT_PATTERN = /^local \w+ = game:GetService\("\w+"\)\s*$/

export class ServiceCompletionProvider implements vscode.CompletionItemProvider {
    public serviceMembers: Promise<Map<string, ApiClass>>

    constructor() {
        this.serviceMembers = getApiDump().then((dump) => {
            const output = new Map()

            for (const klass of dump.Classes) {
                const klassData = {
                    Description: klass.Description,
                    Members: klass.Members.filter((member) => {
                        const tags = member.Tags
                        if (tags !== undefined) {
                            for (const tag of tags) {
                                if (UNSCRIPTABLE_TAGS.has(tag)) {
                                    return false
                                }
                            }
                        }
                        return true
                    }),
                    MemoryCategory: klass.MemoryCategory,
                    Name: klass.Name,
                    Superclass: klass.Superclass,
                    Tags: klass.Tags,
                }
                output.set(klass.Name, klassData)
            }

            return output
        })
    }

    public async createCompletionItems(
        service: ApiClass,
        operator: string,
        inheritMembers = true,
    ): Promise<vscode.CompletionItem[]> {
        let completionItems: vscode.CompletionItem[] = []

        for (const member of service.Members) {
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
            } else if (operator === ".") {
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

        if (inheritMembers) {
            if (service.Superclass) {
                const klass = (await this.serviceMembers).get(service.Superclass)
                if (klass) {
                    const inheritedMembers = await this.createCompletionItems(klass, operator, true)
                    // TODO: Indicate in the completion that this is inherited
                    completionItems = completionItems.concat(inheritedMembers)
                }
            }
        }

        return completionItems
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const serviceMatch = document.lineAt(position.line).text.substr(0, position.character).match(/(\w+)([:.]?)\w*$/)

        if (serviceMatch !== null) {
            const serviceName = serviceMatch[1]
            const operator = serviceMatch[2]

            const service = (await this.serviceMembers).get(serviceName)

            if (service !== undefined && service.Tags && service.Tags.includes("Service")) {
                const documentText = document.getText()

                if (!documentText.match(new RegExp(`^local ${serviceName}\\s*=\\s*`, "m"))) {
                    const insertText = `local ${serviceName} = game:GetService("${serviceName}")\n`
                    const lines = documentText.split(/\n\r?/)

                    const firstImport = lines.findIndex((line) => line.match(IMPORT_PATTERN))
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
                        ),
                    ]

                    if (operator !== "") {
                        item.command = { command: "editor.action.triggerSuggest", title: "Re-trigger completions" }
                    }

                    item.detail = "Auto-import service"
                    item.insertText = operator ? "" : serviceName
                    item.preselect = true

                    return [item]
                }

                const completionItems = await this.createCompletionItems(service, operator, true)

                return completionItems
            }
        }

        return []
    }
}
