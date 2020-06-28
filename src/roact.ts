import * as vscode from "vscode"
import { ApiClass, ApiPropertySecurity, getApiDump } from "./dump"

const UNSCRIPTABLE_TAGS: Set<string> = new Set([
    "Deprecated",
    "Hidden",
    "NotBrowsable",
    "NotScriptable",
])

export class RoactCompletionProvider implements vscode.CompletionItemProvider {
    public instances: Promise<Map<string, ApiClass>>

    constructor() {
        this.instances = getApiDump().then((dump) => {
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
    ): Promise<vscode.CompletionItem[]> {
        let completionItems: vscode.CompletionItem[] = []

        for (const member of service.Members) {
            if (member.MemberType === "Property") {
                const security = member.Security as ApiPropertySecurity
                if (security.Read !== "None" && security.Write !== "None") {
                    continue
                }

                const completionItem = new vscode.CompletionItem(
                    member.Name,
                    vscode.CompletionItemKind.Field,
                )
                completionItem.insertText = `${member.Name} = `
                completionItem.detail = `(property) ${service.Name}.${member.Name}: ${member.ValueType ? member.ValueType.Name : "unknown"}`
                completionItem.documentation = new vscode.MarkdownString(`[Developer Reference](https://developer.roblox.com/en-us/api-reference/event/${service.Name}/${member.Name})`)
                completionItems.push(completionItem)
            } else if (member.MemberType === "Event") {
                if (member.Security !== "None") {
                    continue
                }

                const completionItem = new vscode.CompletionItem(
                    member.Name,
                    vscode.CompletionItemKind.Event,
                )
                completionItem.insertText = `[Roact.Event.${member.Name}] = `
                completionItem.detail = `(event) ${service.Name}.${member.Name}(${member.Parameters.map(parameter => `${parameter.Name}: ${parameter.Type ? parameter.Type.Name : "unknown"}`).join(", ")})`
                completionItem.documentation = new vscode.MarkdownString(`[Developer Reference](https://developer.roblox.com/en-us/api-reference/property/${service.Name}/${member.Name})`)
                completionItems.push(completionItem)
            }
        }

        if (service.Superclass) {
            const klass = (await this.instances).get(service.Superclass)
            if (klass) {
                const inheritedMembers = await this.createCompletionItems(klass)
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
        const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position))
        const functionMatch = text.match(/([\w.]+)\(["'](\w+)["'],\s*{[\w\s\d.="',:()\[\]]*$/)
        if (functionMatch !== null) {
            const callable = functionMatch[1]

            // Check to see if there is an alias
            const aliasMatch = text.match(/^local\s+(\w+)\s*=\s*Roact\.createElement\s*$/m)

            if (callable === "Roact.createElement" || (aliasMatch && callable === aliasMatch[1])) {
                const availableInstances = (await this.instances)
                const instance = availableInstances.get(functionMatch[2])
                if (instance) {
                    return this.createCompletionItems(instance)
                }
            }
        }
    }
}
