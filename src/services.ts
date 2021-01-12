// Service member auto complete

import * as vscode from "vscode"
import { ApiClass, ApiPropertySecurity, getApiDump } from "./dump"

const UNSCRIPTABLE_TAGS: Set<string> = new Set([
    "Deprecated",
    "Hidden",
    "NotBrowsable",
    "NotScriptable",
])

const IMPORT_PATTERN = /^local \w+ = game:GetService\("\w+"\)\s*$/

export class ServiceCompletionProvider implements vscode.CompletionItemProvider {
    serviceMembers: Promise<Map<string, ApiClass>>
    servicesCompletion: Promise<vscode.CompletionItem[]>

    constructor() {
        this.serviceMembers = getApiDump().then(dump => {
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

        this.servicesCompletion = getApiDump().then(dump => {
            const output: vscode.CompletionItem[] = []

            for (const klass of dump.Classes) {
                if (klass.Tags !== undefined && klass.Tags.includes("Service")) {
                    const completionItem = new vscode.CompletionItem(klass.Name, vscode.CompletionItemKind.Class)

                    completionItem.detail = `(service) ${klass.Name}`
                    completionItem.documentation = new vscode.MarkdownString(`${klass.Description ? klass.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/class/${klass.Name})`)

                    output.push(completionItem)
                }
            }

            return output
        })
    }

    async createCompletionItems(
        service: ApiClass,
        operator: string,
    ): Promise<vscode.CompletionItem[]> {
        let completionItems: vscode.CompletionItem[] = []

        for (const member of service.Members) {
            if (member.MemberType === "Property") {
                const security = member.Security as ApiPropertySecurity
                if (security.Read !== "None" && security.Write !== "None") {
                    continue
                }
            } else if (member.Security !== "None") {
                continue
            }

            if (operator === ":") {
                if (member.MemberType === "Function") {
                    const params = []

                    for (const param of member.Parameters) {
                        const paramText = `${param.Name}${param.Default ? "?" : ""}: ${param.Type ? param.Type.Name : "unknown"}${param.Default ? ` = ${param.Default}` : ""}`
                        params.push(paramText)
                    }

                    const completionItem = new vscode.CompletionItem(
                        member.Name,
                        vscode.CompletionItemKind.Method,
                    )

                    completionItem.detail = `(function) ${service.Name}:${member.Name}(${params.join(", ")}): ${member.ReturnType ? member.ReturnType.Name : "unknown"}`
                    completionItem.documentation = new vscode.MarkdownString(`${member.Description ? member.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/function/${service.Name}/${member.Name})`)
                    completionItem.insertText = new vscode.SnippetString(`${member.Name}(${params.length > 0 ? "$0)" : ")$0"}`)

                    completionItems.push(completionItem)
                }
            } else if (operator === ".") {
                switch (member.MemberType) {
                    case "Callback": {
                        const params = []

                        for (const param of member.Parameters) {
                            const paramText = `${param.Name}: ${param.Type ? param.Type.Name : "unknown"}`
                            params.push(paramText)
                        }

                        const completionItem = new vscode.CompletionItem(
                            member.Name,
                            vscode.CompletionItemKind.Constructor,
                        )
                        completionItem.detail = `(callback) ${service.Name}.${member.Name} = function (${params.join(", ")})`
                        completionItem.documentation = new vscode.MarkdownString(`${member.Description ? member.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/callback/${service.Name}/${member.Name})`)

                        completionItems.push(completionItem)
                        break
                    }
                    case "Event": {
                        const params = []

                        for (const param of member.Parameters) {
                            const paramText = `${param.Name}: ${param.Type ? param.Type.Name : "unknown"}`
                            params.push(paramText)
                        }

                        const completionItem = new vscode.CompletionItem(
                            member.Name,
                            vscode.CompletionItemKind.Event,
                        )
                        completionItem.detail = `(event) ${service.Name}.${member.Name}(${params.join(", ")})`
                        completionItem.documentation = new vscode.MarkdownString(`${member.Description ? member.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/property/${service.Name}/${member.Name})`)

                        completionItems.push(completionItem)
                        break
                    }
                    case "Property": {
                        const completionItem = new vscode.CompletionItem(
                            member.Name,
                            vscode.CompletionItemKind.Field,
                        )
                        completionItem.detail = `(property) ${service.Name}.${member.Name}: ${member.ValueType ? member.ValueType.Name : "unknown"}`
                        completionItem.documentation = new vscode.MarkdownString(`${member.Description ? member.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/event/${service.Name}/${member.Name})`)
                        completionItems.push(completionItem)
                        break
                    }
                }
            }
        }

        if (service.Superclass) {
            const klass = (await this.serviceMembers).get(service.Superclass)
            if (klass) {
                const inheritedMembers = await this.createCompletionItems(klass, operator)
                for (const completionItem of inheritedMembers) {
                    if (completionItem.documentation) {
                        (completionItem.documentation as vscode.MarkdownString).value = `Inherited from ${service.Superclass}\n\n${(completionItem.documentation as vscode.MarkdownString).value}`
                    }
                }
                completionItems = completionItems.concat(inheritedMembers)
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

            if (service !== undefined && service.Tags !== undefined && service.Tags.includes("Service")) {
                const documentText = document.getText()

                if (!documentText.match(new RegExp(`^local ${serviceName}\\s*=\\s*`, "m"))) {
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

                const completionItems = await this.createCompletionItems(service, operator)

                return completionItems
            }
        }

        return []
    }
}
