import * as vscode from "vscode"
import { ApiClass, ApiPropertySecurity, getApiDump, UNCREATABLE_TAGS } from "./dump"

const UNSCRIPTABLE_TAGS: Set<string> = new Set([
    "Deprecated",
    "Hidden",
    "NotBrowsable",
    "NotScriptable",
])

const isCreatableInstance = (klass: ApiClass) => klass.Tags === undefined ||
    klass.Tags.every(tag => !UNCREATABLE_TAGS.has(tag))

export class RoactCompletionProvider implements vscode.CompletionItemProvider {
    instances: Promise<Map<string, ApiClass>>
    creatableInstancesItems: Promise<vscode.CompletionItem[]>

    constructor() {
        this.instances = getApiDump().then(dump => {
            const output = new Map()

            for (const klass of dump.Classes) {
                const klassData = {
                    Description: klass.Description,
                    Members: klass.Members.filter(member => member.Tags === undefined ||
                        member.Tags.every(tag => !UNSCRIPTABLE_TAGS.has(tag))),
                    MemoryCategory: klass.MemoryCategory,
                    Name: klass.Name,
                    Superclass: klass.Superclass,
                    Tags: klass.Tags,
                }

                output.set(klass.Name, klassData)
            }

            return output
        })

        this.creatableInstancesItems = getApiDump().then(dump => {
            const completionItems: vscode.CompletionItem[] = []

            for (const klass of dump.Classes.filter(isCreatableInstance)) {
                const completionItem = new vscode.CompletionItem(
                    klass.Name,
                    vscode.CompletionItemKind.Constant,
                )

                completionItem.detail = `(class) ${klass.Name}`
                completionItem.documentation = new vscode.MarkdownString(`[Developer Reference](https://developer.roblox.com/en-us/api-reference/class/${klass.Name})`)
                completionItems.push(completionItem)
            }

            return completionItems
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
                    if (completionItem.documentation !== undefined) {
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
        const functionMatch = text.match(/([\w.]+)\(["'](\w+)["'],\s*{[\w\s\d.-="',:/()\[\]]*$/)
        if (functionMatch !== null) {
            const callable = functionMatch[1]

            // Check to see if there is an alias
            const aliasMatch = text.match(/^local\s+(\w+)\s*=\s*Roact\.createElement\s*$/m)

            if (callable === "Roact.createElement" || (aliasMatch !== null && callable === aliasMatch[1])) {
                const lineText = document.lineAt(position.line).text
                // Don't provide items when entering a value
                // This is done by counting the number of = and the number of matching ,
                // (Comma is checked as multiple items can be assigned on one line)
                const equalsCount = lineText.match(/=/g)?.length
                const commaCount = lineText.match(/,/g)?.length

                if (equalsCount === undefined || (commaCount !== undefined && commaCount >= equalsCount)) {
                    const availableInstances = (await this.instances)
                    const instance = availableInstances.get(functionMatch[2])
                    if (instance !== undefined && isCreatableInstance(instance)) {
                        return this.createCompletionItems(instance)
                    }
                }
            }
        } else {
            const beginningCallMatch = text.match(/([\w.]+)\(["']\w*$/)
            if (beginningCallMatch !== null) {
                // Provide autocomplete to the first argument to Roact.createElement
                const callable = beginningCallMatch[1]

                // Check to see if there is an alias
                const aliasMatch = text.match(/^local\s+(\w+)\s*=\s*Roact\.createElement\s*$/m)

                if (callable === "Roact.createElement" || (aliasMatch !== null && callable === aliasMatch[1])) {
                    return this.creatableInstancesItems
                }
            }
        }
    }
}
